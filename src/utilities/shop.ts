import fs from 'fs/promises';
import path from 'path';
import Safety from './safety.js';
import log from './structs/log.js';
import { dirname } from 'dirname-filename-esm'
import { ShopResponse } from '../types/typings';

const __dirname = dirname(import.meta)

class Shop {

    public async testModule(loopKey): Promise<boolean> {

        const test = await fetch(`http://api.nexusfn.net/api/v1/shop/random/${Safety.env.MAIN_SEASON}`, {
            method: 'GET',
            headers: {
                'loopkey': loopKey
            }
        })

        await test.json()

        if (test.status == 200) {
            return true;
        } else {
            log.warn("Auto rotate has been disabled as you do not have access to it or some unknown error happened. Please go to https://discord.gg/NexusFN and enter the /purchase command to gain access or if you think this is a mistake then please contact a staff member.");
            return false;
        }

    }

    public async updateShop(loopKey: string): Promise<ShopResponse[] | boolean[]> {
        const newItems: any[] = [];

        const [shopResponse, catalogString, catalogRaw] = await Promise.all([
            fetch(`https://api.nexusfn.net/api/v1/shop/random/${Safety.env.MAIN_SEASON}`, {
                method: 'GET',
                headers: {
                    'loopkey': loopKey
                }
            }),
            fs.readFile(path.join(__dirname, "../../Config/catalog_config.json"), 'utf-8'),
            fs.readFile(path.join(__dirname, "../../responses/catalog.json"), 'utf-8')
        ]);

        if (!shopResponse) return [];

        const shopJSON = await shopResponse.json();

        if (shopJSON.error) {
            if (shopJSON.error === "Module shop not enabled for this loopkey") {
                return [false];
            }
        }

        const dailyItems = shopJSON[0].daily;
        const catalog = JSON.parse(catalogString);
        const catalogRawJSON = JSON.parse(catalogRaw);

        for (const [i, dailyItem] of dailyItems.entries()) {
            const { shopName, price } = dailyItem;

            catalog[`daily${i + 1}`].price = price;
            catalog[`daily${i + 1}`].itemGrants = [shopName];

            newItems.push(dailyItem);
        }

        for (const [i, featuredItem] of shopJSON[1].featured.entries()) {
            const { shopName, price } = featuredItem;

            catalog[`featured${i + 1}`].price = price;
            catalog[`featured${i + 1}`].itemGrants = [shopName];

            newItems.push(featuredItem);
        }

        const todayAtMidnight = new Date();
        todayAtMidnight.setHours(24, 0, 0, 0)
        const todayOneMinuteBeforeMidnight = new Date(todayAtMidnight.getTime() - 60000);
        const isoDate = todayOneMinuteBeforeMidnight.toISOString();

        catalogRawJSON.expiration = isoDate

        await Promise.all([
            fs.writeFile(path.join(__dirname, "../../Config/catalog_config.json"), JSON.stringify(catalog, null, 4)),
            fs.writeFile(path.join(__dirname, "../../responses/catalog.json"), JSON.stringify(catalogRawJSON, null, 4))
        ]);

        return newItems;
    }
}

export default new Shop();

