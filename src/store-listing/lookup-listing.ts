import {
  Browser,
  PageEventObject,
  Page,
  HTTPRequest,
  HTTPResponse,
  ResponseForRequest,
  ElementHandle,
  JSHandle,
} from 'puppeteer';
import {Link, Pricing, Store, getStores} from '../store/model';
import { elementIncludesLabels, getPrice, getProductText, includesLabels, pageIncludesLabels, Selector } from './listing-includes-labels';
import {disableBlockerInPage, enableBlockerInPage} from '../adblocker';
import {config} from '../config';
import {fetchLinks} from './fetch-listing-links';
import open from 'open';
import {processBackoffDelay} from './backoff';
import {sendNotification} from '../messaging';
import useProxy from '@doridian/puppeteer-page-proxy';
import {promises as fs} from 'fs';
import path from 'path';
import { StoreListing } from './store-listing';
import { filterStoreLink } from './filter-listing';
import { logger, Print } from './logger-listing';
import { handleCaptchaAsync } from './captcha-handler-listing';
import { getRandomUserAgent, noop, closePage, isStatusCodeInRange, delay, getSleepTime } from './util-listing';

const inStock: Record<string, boolean> = {};

const linkBuilderLastRunTimes: Record<string, number> = {};

function nextProxy(store: StoreListing) {
  if (!store.proxyList) {
    return;
  }

  if (store.currentProxyIndex === undefined) {
    store.currentProxyIndex = 0;
  } else {
    store.currentProxyIndex++;
  }

  if (store.currentProxyIndex >= store.proxyList.length) {
    store.currentProxyIndex = 0;
  }

  logger.debug(
    `ℹ [${store.name}] Next proxy index: ${store.currentProxyIndex} / Count: ${
      store.proxyList.length
    } (${store.proxyList[store.currentProxyIndex]})`
  );

  return store.proxyList[store.currentProxyIndex];
}

async function handleLowBandwidth(request: HTTPRequest) {
  if (!config.browser.lowBandwidth) {
    return false;
  }

  const typ = request.resourceType();
  if (typ === 'font' || typ === 'image') {
    try {
      await request.abort();
    } catch {
      logger.debug('Failed to abort request.');
    }

    return true;
  }

  return false;
}

async function handleProxy(request: HTTPRequest, proxy?: string) {
  if (!proxy) {
    return false;
  }

  try {
    await useProxy(request, proxy);
  } catch (error: unknown) {
    logger.error('handleProxy', error);
    try {
      await request.abort();
    } catch {
      logger.debug('Failed to abort request.');
    }
  }

  return true;
}

async function handleAdBlock(request: HTTPRequest, adBlockRequestHandler: any) {
  if (!adBlockRequestHandler) {
    return false;
  }

  return new Promise(resolve => {
    const continueFunc = async () => {
      resolve(false);
    };

    const abortFunc = async () => {
      try {
        await request.abort();
      } catch {
        logger.debug('Failed to abort request.');
      }

      resolve(true);
    };

    const respondFunc = async (response: ResponseForRequest) => {
      try {
        await request.respond(response);
      } catch {
        logger.debug('Failed to abort request.');
      }

      resolve(true);
    };

    const requestProxy = new Proxy(request, {
      get(target, prop, receiver) {
        if (prop === 'continue') {
          return continueFunc;
        }

        if (prop === 'abort') {
          return abortFunc;
        }

        if (prop === 'respond') {
          return respondFunc;
        }

        return Reflect.get(target, prop, receiver);
      },
    });

    adBlockRequestHandler(requestProxy);
  });
}

/**
 * Responsible for looking up information about a each product within
 * a `Store`. It's important that we ignore `no-await-in-loop` here
 * because we don't want to get rate limited within the same store.
 *
 * @param browser Puppeteer browser.
 * @param store Vendor of items.
 */
async function lookup(browser: Browser, store: StoreListing) {
  if (!getStores().has(store.name)) {
    return;
  }

  if (store.linksBuilder) {
    const lastRunTime = linkBuilderLastRunTimes[store.name] ?? -1;
    const ttl = store.linksBuilder.ttl ?? Number.MAX_SAFE_INTEGER;
    if (lastRunTime === -1 || Date.now() - lastRunTime > ttl) {
      logger.info(`[${store.name}] Running linksBuilder...`);
      try {
        await fetchLinks(store, browser);
        linkBuilderLastRunTimes[store.name] = Date.now();
      } catch (error: unknown) {
        logger.error(error);
      }
    }
  }

  /* eslint-disable no-await-in-loop */
  for (const link of store.links) {
    if (!filterStoreLink(link)) {
      continue;
    }

    if (config.page.inStockWaitTime && inStock[link.url]) {
      logger.info(Print.inStockWaiting(link, store, true));
      continue;
    }

    const proxy = nextProxy(store);

    const useAdBlock = !config.browser.lowBandwidth && !store.disableAdBlocker;
    const customContext = config.browser.isIncognito;

    const context = customContext
      ? await browser.createIncognitoBrowserContext()
      : browser.defaultBrowserContext();
    const page = await context.newPage();
    await page.setRequestInterception(true);

    page.setDefaultNavigationTimeout(config.page.timeout);
    await page.setUserAgent(await getRandomUserAgent());

    let adBlockRequestHandler: any;
    let pageProxy;
    if (useAdBlock) {
      const onProxyFunc = (event: keyof PageEventObject, handler: any) => {
        if (event !== 'request') {
          page.on(event, handler);
          return;
        }

        adBlockRequestHandler = handler;
      };

      pageProxy = new Proxy(page, {
        get(target, prop, receiver) {
          if (prop === 'on') {
            return onProxyFunc;
          }

          // Give dummy setRequestInterception to avoid AdBlock from messing with it
          if (prop === 'setRequestInterception') {
            return noop;
          }

          return Reflect.get(target, prop, receiver);
        },
      });
      await enableBlockerInPage(pageProxy);
    }

    await page.setRequestInterception(true);
    page.on('request', async request => {
      if (await handleLowBandwidth(request)) {
        return;
      }

      if (await handleAdBlock(request, adBlockRequestHandler)) {
        return;
      }

      if (await handleProxy(request, proxy)) {
        return;
      }

      try {
        await request.continue();
      } catch {
        logger.debug('Failed to continue request.');
      }
    });

    if (store.captchaDeterrent) {
      await runCaptchaDeterrent(browser, store, page);
    }

    let statusCode = 0;

    try {
      statusCode = await lookupIem(browser, store, page, link);
    } catch (error: unknown) {
      if (store.currentProxyIndex !== undefined && store.proxyList) {
        const proxy = `${store.currentProxyIndex + 1}/${
          store.proxyList.length
        }`;
        logger.error(
          `✖ [${proxy}] [${store.name}] ${link.brand} ${link.series} ${
            link.model
          } - ${(error as Error).message}`
        );
      } else {
        logger.error(
          `✖ [${store.name}] ${link.brand} ${link.series} ${link.model} - ${
            (error as Error).message
          }`
        );
      }
      const client = await page.target().createCDPSession();
      await client.send('Network.clearBrowserCookies');
    }

    if (pageProxy) {
      await disableBlockerInPage(pageProxy);
    }

    if (
      store.currentProxyIndex !== undefined &&
      store.proxyList &&
      store.proxyList?.length > 1
    ) {
      const client = await page.target().createCDPSession();
      await client.send('Network.clearBrowserCookies');
    }

    // Must apply backoff before closing the page, e.g. if CloudFlare is
    // used to detect bot traffic, it introduces a 5 second page delay
    // before redirecting to the next page
    await processBackoffDelay(store, link, statusCode);
    await closePage(page);
    if (customContext) {
      await context.close();
    }
  }
  /* eslint-enable no-await-in-loop */
}

async function lookupIem(
  browser: Browser,
  store: StoreListing,
  page: Page,
  link: Link
): Promise<number> {
  const givenWaitFor = store.waitUntil ? store.waitUntil : 'networkidle0';
  const response: HTTPResponse | null = await page.goto(link.url, {
    waitUntil: givenWaitFor,
  });

  const successStatusCodes = store.successStatusCodes ?? [[0, 399]];
  const statusCode = await handleResponse(browser, store, page, link, response);

  if (!isStatusCodeInRange(statusCode, successStatusCodes)) {
    return statusCode;
  }

  logger.debug(`[${store.name}] status code: ${statusCode}`);

  const listing = {
    selector: store.listing
  }

  const baseOptions: Selector = {
    requireVisible: false,
    selector: store.labels.container ?? 'body',
    type: 'textContent',
  };
  
  if (store.labels.captcha) {
    logger.info(`[${store.name}] Checking for CAPTCHA...`);
    if (await pageIncludesLabels(page, store.labels.captcha, baseOptions)) {
      logger.warn(Print.captcha(link, store, true));
      if (config.captchaHandler.service && store.labels.captchaHandler) {
        logger.debug(`[${store.name}] captcha handler called`);
        if (!(await handleCaptchaAsync(page, store))) {
          logger.warn(`[${store.name}] captcha handler failed`);
        } else {
          logger.debug(`[${store.name}] captcha handler done, checking item`);
        }
      } else {
        logger.debug(`[${store.name}] captcha handler skipped`);
        await delay(getSleepTime(store));
      }
    }
  }

  if (listing) {

    const components = await page.$$(listing.selector);
    // Evaluate each component individually
    const result = await Promise.all(components.map(async (component) => {
      const isInStock = await isItemInStock(store, page, component, link);
      if (isInStock) {
        sendNotification(link, store);
        if (config.page.inStockWaitTime) {
          inStock[link.url] = true;
          setTimeout(() => {
            inStock[link.url] = false;
          }, 1000 * config.page.inStockWaitTime);
        }
      }
      return isInStock;
    }));
  }


  return statusCode;
}

// eslint-disable-next-line max-params
async function handleResponse(
  browser: Browser,
  store: StoreListing,
  page: Page,
  link: Link,
  response?: HTTPResponse | null,
  recursionDepth = 0
) {
  if (!response) {
    logger.debug(Print.noResponse(link, store, true));
  }

  const successStatusCodes = store.successStatusCodes ?? [[0, 399]];
  let statusCode = response?.status() ?? 0;
  if (!isStatusCodeInRange(statusCode, successStatusCodes)) {
    if (statusCode === 429) {
      logger.warn(Print.rateLimit(link, store, true));
    } else if (statusCode === 503) {
      if (await checkIsCloudflare(store, page, link)) {
        if (recursionDepth > 4) {
          logger.warn(Print.recursionLimit(link, store, true));
        } else {
          const response: HTTPResponse | null = await page.waitForNavigation({
            waitUntil: 'networkidle0',
          });
          recursionDepth++;
          statusCode = await handleResponse(
            browser,
            store,
            page,
            link,
            response,
            recursionDepth
          );
        }
      } else {
        logger.warn(Print.badStatusCode(link, store, statusCode, true));
      }
    } else {
      logger.warn(Print.badStatusCode(link, store, statusCode, true));
    }
  }

  return statusCode;
}

async function checkIsCloudflare(store: StoreListing, page: Page, link: Link) {
  const baseOptions: Selector = {
    requireVisible: true,
    selector: 'body',
    type: 'textContent',
  };

  const cloudflareLabel = {
    container: 'div[class="attribution"] a[rel="noopener noreferrer"]',
    text: ['Cloudflare'],
  };

  if (await pageIncludesLabels(page, cloudflareLabel, baseOptions)) {
    logger.warn(Print.cloudflare(link, store, true));
    return true;
  }

  return false;
}

async function isItemInStock(
  store: StoreListing,
  page: Page,
  element: ElementHandle,
  link: Link
): Promise<boolean> {
  const baseOptions: Selector = {
    requireVisible: false,
    selector: store.labels.container ?? 'body',
    type: 'textContent',
  };

  let productText;
  if (store.productText) {
    productText = await getProductText(page, element, store.productText, baseOptions);
  }

  if (store.labels.bannedSeller) {
    if (
      await elementIncludesLabels(page, element, store.labels.bannedSeller, baseOptions)
    ) {
      logger.warn(Print.bannedSeller(link, store, true));
      return false;
    }
  }

  if (store.labels.outOfStock) {
    if (await elementIncludesLabels(page, element, store.labels.outOfStock, baseOptions)) {
      logger.info(Print.outOfStock(link, store, true, productText));
      return false;
    }
  }

  if (link.labels?.inStock) {
    const options = {
      ...baseOptions,
      requireVisible: true,
      type: 'outerHTML' as const,
    };

    if (!(await elementIncludesLabels(page, element, link.labels.inStock, options))) {
      logger.info(Print.outOfStock(link, store, true, productText));
      return false;
    }
  }

  if (store.labels.inStock) {
    const options = {
      ...baseOptions,
      requireVisible: true,
      type: 'outerHTML' as const,
    };

    if (!(await elementIncludesLabels(page, element, store.labels.inStock, options))) {
      logger.info(Print.outOfStock(link, store, true, productText));
      return false;
    }
  }

  if (store.labels.maxPrice) {
    const maxPrice = config.store.maxPrice.series[link.series];

    link.price = await getPrice(page, element, store.labels.maxPrice, baseOptions);

    if (link.price && link.price > maxPrice && maxPrice > 0) {
      logger.info(Print.maxPrice(link, store, maxPrice, true, productText));
      return false;
    }
  }

  return true;
}

async function runCaptchaDeterrent(browser: Browser, store: StoreListing, page: Page) {
  const successStatusCodes = store.successStatusCodes ?? [[0, 399]];
  let statusCode = 0;
  let deterrentLinks: string[] = [];

  logger.debug(`[${store.name}] Navigating to random anti-captcha page...`);

  if (store.captchaDeterrent?.hardLinks?.length) {
    deterrentLinks = deterrentLinks.concat(store.captchaDeterrent.hardLinks);
  }

  if (store.captchaDeterrent?.searchUrl) {
    if (store.captchaDeterrent.searchTerms) {
      store.captchaDeterrent.searchTerms.forEach(element =>
        deterrentLinks.push(
          store.captchaDeterrent?.searchUrl
            ? store.captchaDeterrent.searchUrl.replace('%%s', element)
            : ''
        )
      );
    }
  }

  if (deterrentLinks.length > 0) {
    const link: Link = {
      brand: 'captcha-deterrent',
      model: 'captcha-deterrent',
      series: 'captcha-deterrent',
      url: deterrentLinks[Math.floor(Math.random() * deterrentLinks.length)],
    };
    logger.debug(`Selected captcha-deterrent link: ${link.url}`);

    try {
      const givenWaitFor = store.waitUntil ? store.waitUntil : 'networkidle0';
      const response: HTTPResponse | null = await page.goto(link.url, {
        waitUntil: givenWaitFor,
      });
      statusCode = await handleResponse(browser, store, page, link, response);
      setTimeout(() => {
        // Do nothing
      }, 3000);
    } catch (error: unknown) {
      logger.error(error);
    }

    if (!isStatusCodeInRange(statusCode, successStatusCodes)) {
      logger.warn(
        `✖ [${store.name}] - Failed to navigate to anti-captcha target: ${link.url}`
      );
    }
  }
}

export async function tryListingLookupAndLoop(browser: Browser, store: StoreListing) {
  if (!browser.isConnected()) {
    logger.silly(`[${store.name}] Ending this loop as browser is disposed...`);
    return;
  }

  logger.silly(`[${store.name}] Starting listing lookup...`);
  try {
    await lookup(browser, store);
  } catch (error: unknown) {
    logger.error(error);
  }

  const sleepTime = 5000;
  logger.silly(`[${store.name}] Listing lookup done, next one in ${sleepTime} ms`);
  setTimeout(tryListingLookupAndLoop, sleepTime, browser, store);
}
