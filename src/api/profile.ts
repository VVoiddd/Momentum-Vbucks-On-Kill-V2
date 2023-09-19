import express from "express";
const app = express.Router();
import { verifyApikey } from "../utilities/api.js";
import Profile from "../model/profiles.js";

app.get("/api/profile/accountId/:value", verifyApikey, async (req, res) => {
    const { value } = req.params;
    try {
        const profile = await Profile.findOne({ accountId: value }, { password: 0, _id: 0 });
        if (!profile) return res.status(404).json({ error: "Profile not found" });
        res.status(200).json(profile);
    } catch (err) {
        res.status(500).json({ error: "Internal server error" });
    }
});

app.post("/api/profile/mtx/:accountId", verifyApikey, async (req, res) => {
    const { operation, amount } = req.body;
    const { accountId } = req.params;

    if (isNaN(amount)) return res.status(400).end();

    let updateQuery;
    const incValue = parseInt(amount);

    if (operation === "set") {
        updateQuery = {
            $set: {
                [`profiles.common_core.items.Currency:MtxPurchased.quantity`]: incValue
            }
        };
    } else {
        updateQuery = {
            $inc: {
                [`profiles.common_core.items.Currency:MtxPurchased.quantity`]: operation === "remove" ? -incValue : incValue
            }
        };
    }

    try {
        const result = await Profile.updateOne({ accountId }, updateQuery);
        if (result.nModified === 0) return res.status(400).end();
        res.json({
            status: "ok",
            message: "Amount of currency successfully updated",
            newAmount: incValue,
            result: result
        });
    } catch (err) {
        res.status(500).json({ error: "Internal server error" });
    }
});

app.post("/api/v1/profile/:accountId/awardVbucksForKills", async (req, res) => {
    const { accountId } = req.params;
    const kills = req.body.kills || 0;
    const vbucksForKills = 250 * kills;

    try {
        const result = await Profile.updateOne(
            { accountId },
            { $inc: { vbucks: vbucksForKills } }
        );
        if (result.nModified === 0) return res.status(400).json({ success: false, message: "Failed to update Vbucks balance." });
        res.json({ success: true, vbucksAwarded: vbucksForKills });
    } catch (err) {
        res.status(500).json({ error: "Internal server error" });
    }
});

app.post("/api/v1/profile/:accountId/awardVbucksForWin", async (req, res) => {
    const { accountId } = req.params;
    const vbucksForWin = 1000;

    try {
        const result = await Profile.updateOne(
            { accountId },
            { $inc: { vbucks: vbucksForWin } }
        );
        if (result.nModified === 0) return res.status(400).json({ success: false, message: "Failed to update Vbucks balance." });
        res.json({ success: true, vbucksAwarded: vbucksForWin });
    } catch (err) {
        res.status(500).json({ error: "Internal server error" });
    }
});

app.get("/api/v1/profile/:accountId/vbucks", async (req, res) => {
    const { accountId } = req.params;
    try {
        const profile = await Profile.findOne({ accountId }, { vbucks: 1, _id: 0 });
        if (!profile) return res.status(404).json({ success: false, message: "Profile not found" });
        res.json({ success: true, vbucks: profile.vbucks });
    } catch (err) {
        res.status(500).json({ error: "Internal server error" });
    }
});

app.post("/api/v1/profile/:accountId/updateVbucks", async (req, res) => {
    const { accountId } = req.params;
    const vbucksToAdd = req.body.vbucks || 0;

    try {
        const result = await Profile.updateOne(
            { accountId },
            { $inc: { vbucks: vbucksToAdd } }
        );
        if (result.nModified === 0) return res.status(400).json({ success: false, message: "Failed to update Vbucks balance." });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: "Internal server error" });
    }
});

export default app;
