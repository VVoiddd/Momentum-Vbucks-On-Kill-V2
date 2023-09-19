import mongoose from "mongoose";

const ProfilesSchema = new mongoose.Schema(
    {
        created: { type: Date, required: true },
        accountId: { type: String, required: true, unique: true },
        profiles: { type: Object, required: true }
    },
    {
        collection: "profiles"
    
// Vbucks balance attribute
vbucks: {
    type: Number,
    default: 0
}

}