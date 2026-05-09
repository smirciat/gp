module.exports = {
apps : [{
	name: "goldPoints",
	script: "/home/andy/goldPoints/dist/server",
	interpreter: "/home/andy/.nvm/versions/node/v10.24.1/bin/node",
	env: {
		NODE_ENV: "production"
	}
}]
};