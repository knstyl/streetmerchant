import {Store} from './store';

export const Walmart: Store = {
  currency: '$',
  labels: {
    inStock: {
      container: '[data-automation-id="atc"]',
      text: ['add to cart'],
    },
    maxPrice: {
      container: '[data-seo-id="hero-price"]',
    },
  },
  links: [
    {
      brand: 'test:brand',
      model: 'test:model',
      series: 'test:series',
      url: 'https://www.walmart.com/ip/Keurig-K-compact-Brewer-Black-Coffee-Maker/806217614',
    },
    {
      brand: 'sony',
      model: 'ps5 console',
      series: 'sonyps5c',
      url: 'https://www.walmart.com/ip/PlayStation5-Console/363472942',
    },
    {
      brand: 'sony',
      model: 'ps5 digital',
      series: 'sonyps5de',
      url: 'https://www.walmart.com/ip/Sony-PlayStation-5-Digital-Edition/493824815',
    },
    {
      brand: 'microsoft',
      model: 'xbox series x',
      series: 'xboxsx',
      url: 'https://www.walmart.com/ip/Xbox-Series-X/443574645',
    },
    {
      brand: 'microsoft',
      model: 'xbox series s',
      series: 'xboxss',
      url: 'https://www.walmart.com/ip/Xbox-Series-S/606518560',
    },
    {
      brand: 'corsair',
      model: '750 platinum',
      series: 'sf',
      url: 'https://www.walmart.com/ip/SF750-Power-Supply/197046151',
    },
    {
      brand: 'corsair',
      model: '600 platinum',
      series: 'sf',
      url: 'https://www.walmart.com/ip/Corsair-SF-Series-600W-80-Platinum-Power-Supply/250717047',
    },
    {
      brand: 'amd',
      model: '5900x',
      series: 'ryzen5900',
      url: 'https://www.walmart.com/ip/AMD-Ryzen-9-5900X-12-core-24-thread-Desktop-Processor/647899167',
    },
    {
      brand: 'evga',
      model: 'ftw3 ultra',
      series: '3060ti',
      url: 'https://www.walmart.com/ip/912221235',
    },
    {
      brand: 'evga',
      model: 'ftw3 ultra',
      series: '3070',
      url: 'https://www.walmart.com/ip/804934537',
    },
    {
      brand: 'asrock',
      model: 'nova',
      series: 'x870e',
      url: 'https://www.walmart.com/ip/ASRock-X870E-NOVA-WIFI-AM5-AMD-X870E-SATA-6Gb-s-ATX-Motherboard/12739601206'
    },
    {
      brand: 'msi',
      model: 'vanguard soc',
      series: '5090',
      url: 'https://www.walmart.com/ip/MSI-Vanguard-GeForce-RTX-5090-VANGUARD-SOC-Launch-Edition/15097454997'
    },
    {
      brand: 'pny',
      model: 'oc',
      series: '5090',
      url: 'https://www.walmart.com/ip/PNY-GeForce-RTX-5090-Overclocked-Triple-Fan-GPU-DLSS4/15046623228'
    },
    {
      brand: 'pny',
      model: 'epic x oc',
      series: '5090',
      url: 'https://www.walmart.com/ip/PNY-GeForce-RTX-5090-EPIC-X-ARGB-Overclocked-Triple-Fan-GPU-DLSS4/15072274444'
    },
    {
      brand: 'msi',
      model: 'gaming trio oc',
      series: '5090',
      url: 'https://www.walmart.com/ip/MSI-Gaming-Trio-GeForce-RTX-5090-32G-GAMING-TRIO-OC/15130965845'
    },
    {
      brand: 'pny',
      model: 'epic x',
      series: '5090',
      url: 'https://www.walmart.com/ip/PNY-GeForce-RTX-5080-16GB-ARGB-Overclocked-Triple-Fan/15077808167'
    }
  ],
  name: 'walmart',
  country: 'US',
};
