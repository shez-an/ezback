const axios = require('axios');
let marketPriceCache = null;
let lastCacheTime = 0;
const CACHE_DURATION = 24 * 60 * 60 * 1000; // Cache duration: 1 day // Cache duration: 10 minutes

const getInventory = async (appid, steamid, contextid = 2, tradeable = false) => {
  console.log("Fetching inventory...");

  if (typeof appid !== 'number') appid = 730;
  if (typeof contextid === 'string') contextid = parseInt(contextid, 10);
  if (typeof tradeable !== 'boolean') tradeable = false;
  if (!steamid) {
    throw new Error('SteamID is required');
  }

  try {
    const url = `https://steamcommunity.com/inventory/${steamid}/${appid}/${contextid}`;
    const response = await axios.get(url);
    const body = response.data;

    // Handle the case where body.assets is null or undefined
    let assets = body.assets || [];
    let items = body.descriptions || [];

    // If assets are empty, return an empty data structure
    if (assets.length === 0) {
      return {
        raw: body,
        items: [],
        marketnames: [],
        assets: [],
        assetids: [],
      };
    }

    // Check if the cache is valid
    if (!marketPriceCache || Date.now() - lastCacheTime > CACHE_DURATION) {
      console.log("Fetching prices from the market API...");
      const marketApiUrl = 'https://ez-skin-trade-jj29.vercel.app/items'; // Replace with your API endpoint
      const marketApiResponse = await axios.get(marketApiUrl);
      marketPriceCache = marketApiResponse.data;
      lastCacheTime = Date.now();
    } else {
      console.log("Using cached prices...");
    }

    // Create a map for quick price lookup
    const marketPriceMap = {};
    for (const marketItem of marketPriceCache) {
      marketPriceMap[marketItem.name] = marketItem.price;
    }

    // Create a map to group assets by their market_hash_name
    let groupedItems = {};

    for (let asset of assets) {
      let description = items.find(
        item => item.classid === asset.classid && item.instanceid === asset.instanceid
      );
      if (description) {
        let market_hash_name = description.market_hash_name;

        if (!groupedItems[market_hash_name]) {
          groupedItems[market_hash_name] = {
            market_hash_name: market_hash_name,
            icon_url: `https://steamcommunity-a.akamaihd.net/economy/image/${description.icon_url}`,
            price: marketPriceMap[market_hash_name] || '0 USD', // Get price from the API or cache
            quantity: 0,
            assetIds: [],
          };
        }

        groupedItems[market_hash_name].quantity += 1;
        groupedItems[market_hash_name].assetIds.push(asset.assetid);
      }
    }

    let data = {
      raw: body,
      items: Object.values(groupedItems),
      marketnames: Object.keys(groupedItems),
      assets: assets.map(asset => asset.assetid),
      assetids: Object.values(groupedItems).flatMap(item => item.assetIds),
    };

    if (tradeable) {
      data.items = data.items.filter(x => x.tradable === 1);
    }

    return data;
  } catch (error) {
    console.error('Inventory Error:', error.response ? error.response.data : error.message);
    throw error;
  }
};

module.exports = {
  getInventory
};






















// const rustMarketItems = require('../rust_market_items.json');
// const axios = require('axios');




// const getInventory = async (appid, steamid, contextid = 2, tradeable = false) => {
//   console.log("check");
  
//   if (typeof appid !== 'number') appid = 730;
//   if (typeof contextid === 'string') contextid = parseInt(contextid, 10);
//   if (typeof tradeable !== 'boolean') tradeable = false;
//   if (!steamid) {
//     throw new Error('SteamID is required');
//   }
  

//   try {
//     const url = `https://steamcommunity.com/inventory/${steamid}/${appid}/${contextid}`;
//     const response = await axios.get(url);
    
//     const body = response.data;

//     // Handle the case where body.assets is null or undefined
//     let assets = body.assets || [];
//     let items = body.descriptions || [];
//     let marketnames = [];
//     let assetids = [];
//     let prices = [];

//     // If assets are empty, return an empty data structure
//     if (assets.length === 0) {
//       return {
//         raw: body,
//         items: [],
//         marketnames: [],
//         assets: [],
//         assetids: [],
//       };
//     }

//     // Create a map to group assets by their market_hash_name
//     let groupedItems = {};

//     for (let asset of assets) {
//       let description = items.find(
//         item => item.classid === asset.classid && item.instanceid === asset.instanceid
//       );
//       if (description) {
//         let market_hash_name = description.market_hash_name;

//         if (!groupedItems[market_hash_name]) {
//           groupedItems[market_hash_name] = {
//             market_hash_name: market_hash_name,
//             icon_url: `https://steamcommunity-a.akamaihd.net/economy/image/${description.icon_url}`,
//             price: 0,
//             quantity: 0,
//             assetIds: [],
//           };

//           // Find the corresponding price for the item from rust_market_items.json
//           const marketItem = rustMarketItems.find(
//             marketItem => marketItem.name === market_hash_name
//           );
//           groupedItems[market_hash_name].price = marketItem ? marketItem.price : '0 USD';
//         }

//         groupedItems[market_hash_name].quantity += 1;
//         groupedItems[market_hash_name].assetIds.push(asset.assetid);
//       }
//     }

//     let data = {
//       raw: body,
//       items: Object.values(groupedItems),
//       marketnames: Object.keys(groupedItems),
//       assets: assets.map(asset => asset.assetid),
//       assetids: Object.values(groupedItems).flatMap(item => item.assetIds),
//     };

//     if (tradeable) {
//       data.items = data.items.filter(x => x.tradable === 1);
//     }
    
//     return data;
//   } catch (error) {
//     console.error('Inventory Error:', error.response ? error.response.data : error.message);
//     throw error;
//   }
// };


// module.exports = {
//   getInventory
// };












// // const getInventory = async (appid, steamid, contextid = 2, tradeable = false) => {
// //   console.log("check");
  
// //   if (typeof appid !== 'number') appid = 730;
// //   if (typeof contextid === 'string') contextid = parseInt(contextid, 10);
// //   if (typeof tradeable !== 'boolean') tradeable = false;
// //   if (!steamid) {
// //     throw new Error('SteamID is required');
// //   }

// //   try {
// //     // console.log("jhkdfjhkjshkjdhskjh",`https://steamcommunity.com/inventory/${steamid}/${appid}/${contextid}`);
// //     const url = `https://steamcommunity.com/inventory/${steamid}/${appid}/${contextid}`
// //     const response = await axios.get(url);
// //     // console.log(response);
    
// //     const body = response.data;
// //     // console.log(url);

// //     let items = body.descriptions;
// //     let assets = body.assets;
// //     let marketnames = [];
// //     let assetids = [];
// //     let prices = [];

// //     // Create a map to group assets by their market_hash_name
// //     let groupedItems = {};

// //     for (let asset of assets) {
// //       let description = items.find(item => item.classid === asset.classid && item.instanceid === asset.instanceid);
// //       if (description) {
// //         let market_hash_name = description.market_hash_name;

// //         if (!groupedItems[market_hash_name]) {
// //           groupedItems[market_hash_name] = {
// //             market_hash_name: market_hash_name,
// //             icon_url: `https://steamcommunity-a.akamaihd.net/economy/image/${description.icon_url}`,
// //             price: 0,
// //             quantity: 0,
// //             assetIds: [],
// //           };

// //           // Find the corresponding price for the item from rust_market_items.json
// //           const marketItem = rustMarketItems.find(marketItem => marketItem.name === market_hash_name);
// //           groupedItems[market_hash_name].price = marketItem ? marketItem.price : '0 USD';
// //           // console.log(groupedItems[market_hash_name]);
          
// //         }

// //         groupedItems[market_hash_name].quantity += 1;
// //         groupedItems[market_hash_name].assetIds.push(asset.assetid);
// //       }
// //     }

// //     let data = {
// //       raw: body,
// //       items: Object.values(groupedItems),
// //       marketnames: Object.keys(groupedItems),
// //       assets: assets.map(asset => asset.assetid),
// //       assetids: Object.values(groupedItems).flatMap(item => item.assetIds),
// //     };

// //     if (tradeable) {
// //       data.items = data.items.filter(x => x.tradable === 1);
// //     }
// //     // console.log(data);
    
// //     return data;
// //   } catch (error) {
// //     // console.log(error);
    
// //     console.error('Inventory Error:', error.response ? error.response.data : error.message);
// //     throw error;
// //   }
// // };

