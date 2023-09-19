import Cron from "croner";
import modules from "../modules.js";
import Safety from "../safety.js";
import log from "../structs/log.js";
import Shop from '../shop.js';

if (Safety.env.ENABLE_CLOUD) {

    log.backend("Cloud features enabled. This is a beta feature, please report any bugs to https://discord.gg/NexusFN");

    const LOOP_KEY = await Safety.getLoopKey();
    const availabeModules = await modules.getModules(LOOP_KEY);
    if (!availabeModules) log.warn("Are you sure you have a valid loop key or a NexusFN account? For support, join https://discord.gg/NexusFN");

    modules.configureModules(availabeModules as string[]);

    if (Safety.modules.Shop) {
        log.backend("Shop module enabled");
        const shopCron = Cron('0 0 * * *', () => {
            console.log("Updating shop");
            Shop.updateShop(LOOP_KEY);
        });
    }
}