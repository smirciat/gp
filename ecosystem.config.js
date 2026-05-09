module.exports = {
apps : [{
	name: "fraBering",
	script: "/home/andy/goldPoints/dist/server",
	interpreter: "/home/andy/.nvm/versions/node/v10.24.1/bin/node",
    node_args: "--max-old-space-size=4096",
	env: {
		NODE_ENV: "production"
	}
}]
};