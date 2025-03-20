import fetch from 'node-fetch';
import { StoreListing } from '../store-listing';

export const NeweggListing: StoreListing = {
    name: 'newegg',
    country: 'USA',
    currency: '$',
    listing: '.item-cell',
    productText: '.item-title',
    labels: {
        captcha: {
            container: 'body',
            text: ['are you a human?'],
        },
        captchaHandler: {
            challenge: '#imageCode',
            input: '#userInput',
            submit: 'input[type="button"]',
        },
        inStock: [
            {
                container: '.item-action',
                text: ['add to cart'],
            },
            {
                container: '.loading-text',
                text: ['add to cart'],
            },
        ],
        maxPrice: {
            container: '.item-action .price-current',
        },
        outOfStock: [
            {
                container: '.item-info',
                text: ['out of stock'],
            },
            {
                container: '.item-action',
                text: ['out of stock '],
            },
        ],
    },
    links: [
        {
            brand: 'listing',
            model: 'listing',
            series: '5090',
            url: 'https://www.newegg.com/p/pl?N=100007709%20601469153&d=GeForce+RTX&isdeptsrh=1',
        }
    ]
}