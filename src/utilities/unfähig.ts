
class unfähigClass {

    async getIp(): Promise<string> {
        const ip = await fetch("https://api.seeip.org/jsonip?")
        .then(res => res.json())
        .then(json => {
            return json.ip;
        });
        return ip;
    }

}

const unfähig = new unfähigClass();

export default unfähig;