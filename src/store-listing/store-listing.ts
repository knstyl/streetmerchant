import { PuppeteerLifeCycleEvent, Browser } from "puppeteer";
import { StatusCodeRangeArray, Series, Link, Labels, CaptchaDeterrent, Brand, Model, CaptchaHandlerElements, LabelQuery, Pricing, Element } from "../store/model";

export type StoreListing = {
    realTimeInventoryLookup?: (itemNumber: string) => Promise<boolean>;
    /**
     * The range of status codes which will trigger backoff, i.e. an increasing
     * delay between requests. Setting an empty array will disable the feature.
     * If not defined, the default range will be used: 403.
     */
    backoffStatusCodes?: StatusCodeRangeArray;
    disableAdBlocker?: boolean;
    links: Link[];
    linksBuilder?: {
      builder: (docElement: cheerio.Cheerio, series: Series) => Link[];
      ttl?: number;
      waitUntil?: PuppeteerLifeCycleEvent;
      waitForSelector?: string;
      urls: Array<{series: Series; url: string | string[]}>;
    };
    listing: string;
    productText: string,
    labels: Labels;
    name: string;
    country: string;
    currency: '£' | '$' | '€' | 'R$' | 'kr.' | '';
    setupAction?: (browser: Browser) => void;
    /**
     * The range of status codes which considered successful, i.e. without error
     * allowing request parsing to continue. Setting an empty array will cause
     * all requests to fail. If not defined, the default range will be used:
     * 0 -> 399 inclusive.
     */
    successStatusCodes?: StatusCodeRangeArray;
    waitUntil?: PuppeteerLifeCycleEvent;
    minPageSleep?: number;
    maxPageSleep?: number;
  
    proxyList?: string[];
    currentProxyIndex?: number;
    captchaDeterrent?: CaptchaDeterrent;
  };
