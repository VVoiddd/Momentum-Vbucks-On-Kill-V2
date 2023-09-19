import express, { Request } from "express";
const app = express.Router();

import error from "../utilities/structs/error.js";

import { verifyToken } from "../tokenManager/tokenVerify.js";
import User from "../model/user.js";

app.get("/account/api/public/account", async (req, res) => {
    let response:Object[] = [];

    if (typeof req.query.accountId == "string") {
        let user = await User.findOne({ accountId: req.query.accountId, banned: false }).lean();

        if (user) {
            response.push({
                id: user.accountId,
                displayName: user.username,
                externalAuths: {}
            });
        }
    }

    if (Array.isArray(req.query.accountId)) {
        let users = await User.find({ accountId: { $in: req.query.accountId }, banned: false }).lean();

        if (users) {
            for (let user of users) {
                if (response.length >= 100) break;
                
                response.push({
                    id: user.accountId,
                    displayName: user.username,
                    externalAuths: {}
                });
            }
        }
    }

    res.json(response);
});

app.get("/account/api/public/account/displayName/:displayName", async (req, res) => {
    let user = await User.findOne({ username_lower: req.params.displayName.toLowerCase(), banned: false }).lean();
    if (!user) return error.createError(
        "errors.com.epicgames.account.account_not_found",
        `Sorry, we couldn't find an account for ${req.params.displayName}`, 
        [req.params.displayName], 18007, undefined, 404, res
    );
    
    res.json({
        id: user.accountId,
        displayName: user.username,
        externalAuths: {}
    });
});

app.get("/persona/api/public/account/lookup", async (req, res) => {
    if (typeof req.query.q != "string" || !req.query.q) return error.createError(
        "errors.com.epicgames.bad_request",
        "Required String parameter 'q' is invalid or not present", 
        undefined, 1001, undefined, 400, res
    );

    let user = await User.findOne({ username_lower: req.query.q.toLowerCase(), banned: false }).lean();
    if (!user) return error.createError(
        "errors.com.epicgames.account.account_not_found",
        `Sorry, we couldn't find an account for ${req.query.q}`, 
        [req.query.q], 18007, undefined, 404, res
    );
    
    res.json({
        id: user.accountId,
        displayName: user.username,
        externalAuths: {}
    });
});

app.get("/api/v1/search/:accountId", async (req, res) => {
    let response:Object[] = [];

    if (typeof req.query.prefix != "string" || !req.query.prefix) return error.createError(
        "errors.com.epicgames.bad_request",
        "Required String parameter 'prefix' is invalid or not present", 
        undefined, 1001, undefined, 400, res
    );

    let users = await User.find({ username_lower: new RegExp(`^${req.query.prefix.toLowerCase()}`), banned: false }).lean();

    for (let user of users) {
        if (response.length >= 100) break;

        response.push({
            accountId: user.accountId,
            matches: [
                {
                    "value": user.username,
                    "platform": "epic"
                }
            ],
            matchType: req.query.prefix.toLowerCase() == user.username_lower ? "exact" : "prefix",
            epicMutuals: 0,
            sortPosition: response.length
        });
    }
    
    res.json(response);
});

app.get("/account/api/public/account/:accountId", verifyToken, (req: Request, res) => {
    res.json({
        id: req.user.accountId,
        displayName: req.user.username,
        name: "Lawin",
        email: `[hidden]@${req.user.email.split("@")[1]}`,
        failedLoginAttempts: 0,
        lastLogin: new Date().toISOString(),
        numberOfDisplayNameChanges: 0,
        ageGroup: "UNKNOWN",
        headless: false,
        country: "US",
        lastName: "Server",
        preferredLanguage: "en",
        canUpdateDisplayName: false,
        tfaEnabled: false,
        emailVerified: true,
        minorVerified: false,
        minorStatus: "NOT_MINOR",
        cabinedMode: false,
        hasHashedEmail: false
    });
});

app.get("/account/api/public/account/*/externalAuths", (req, res) => {
    res.json([]);
});

app.get("/sdk/v1/*", (req, res) => {
    const sdk = require("./../responses/sdkv1.json");
    res.json(sdk);
})

app.get("/epic/id/v2/sdk/accounts", async (req, res) => {
    let user = await User.findOne({ accountId: req.query.accountId, banned: false }).lean();
    if (!user) return error.createError(
        "errors.com.epicgames.account.account_not_found",
        `Sorry, we couldn't find an account for ${req.query.accountId}`, 
        [req.query.accountId], 18007, undefined, 404, res
    );
    res.json([{
        accountId: user.accountId,
        displayName: user.username,
        preferredLanguage: "en",
        cabinedMode: false,
        empty: false
    }]);
})

app.all("/v1/epic-settings/public/users/*/values", (req, res) => {
    res.json({});
})


export default app;

// Endpoint to award vbucks for kills
app.post("/api/v1/profile/:accountId/awardVbucksForKills", async (req, res) => {
    const accountId = req.params.accountId;
    const kills = req.body.kills || 0; 
    const vbucksForKills = 250 * kills;

    const updateQuery = { $inc: { vbucks: vbucksForKills } };
    const result = await Profile.updateOne({ accountId }, updateQuery);
    
    if (result.nModified > 0) {
        res.json({ success: true, vbucksAwarded: vbucksForKills });
    } else {
        res.json({ success: false, message: "Failed to update Vbucks balance." });
    }
});

// Endpoint to award vbucks for a win
app.post("/api/v1/profile/:accountId/awardVbucksForWin", async (req, res) => {
    const accountId = req.params.accountId;
    const vbucksForWin = 1000;

    const updateQuery = { $inc: { vbucks: vbucksForWin } };
    const result = await Profile.updateOne({ accountId }, updateQuery);

    if (result.nModified > 0) {
        res.json({ success: true, vbucksAwarded: vbucksForWin });
    } else {
        res.json({ success: false, message: "Failed to update Vbucks balance." });
    }
});

// Endpoint to fetch a user's Vbucks balance
app.get("/api/v1/profile/:accountId/vbucks", async (req, res) => {
    const accountId = req.params.accountId;
    const user = await Profile.findOne({ accountId }).lean();

    if (user) {
        res.json({ success: true, vbucks: user.vbucks });
    } else {
        res.json({ success: false, message: "User not found." });
    }
});

// Internal endpoint to update a user's Vbucks balance
app.post("/api/v1/profile/:accountId/updateVbucks", async (req, res) => {
    const accountId = req.params.accountId;
    const vbucksToAdd = req.body.vbucks || 0;

    const updateQuery = { $inc: { vbucks: vbucksToAdd } };
    const result = await Profile.updateOne({ accountId }, updateQuery);

    if (result.nModified > 0) {
        res.json({ success: true, vbucksUpdated: vbucksToAdd });
    } else {
        res.json({ success: false, message: "Failed to update Vbucks balance." });
    }
});

