module.exports = {
apps : [{
	name: "goldPoints",
	script: "/home/andy/goldPoints/dist/server",
	interpreter: "/home/andy/.nvm/versions/node/v12.22.12/bin/node",
	env: {
		NODE_ENV: "production"
	}
}]
};