const path = require("path");
const Stream = require("stream");
const https = require("https");
const fetch = require("node-fetch");
require("dotenv").config();
const { Client, Intents } = require("discord.js");
const Discord = require("discord.js");
const client = new Client({intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES]});
client.login(process.env["TOKEN"]);
client.on("rateLimit", console.log)
/**
 * @type {Discord.TextChannel}
 */
let channel = null;
let stores = null;
let i = 0;
const DiscordPromise = new Promise((resolve) => {
	client.on("ready", async () => {
		channel = await client.channels.fetch(process.env["CHANNEL"]);
		stores = (await (await client.guilds.fetch(process.env["GUILD"])).channels.fetch()).filter(cval => cval.name.startsWith("store"));
		resolve();
	});
});
/*
 * Active upload format
 * title: Filename
 * author: Author name
 * 
 */
let activeUploads = {};

/* 
 * Metadata format
 * Line 1: Metadata Version (int)
 * Line 2: File Name (str) (base64)
 * Line 3: Date uploaded (unix timestamp [long])
 * Line 4: Author (str) (base64)
 * Line 5-*: Chunk channelid/messageid (str)
 * Last line: blank
 */
function sleep(ms) {
	return (new Promise((resolve) => {setTimeout(resolve, ms)}));
}
// Require the fastify framework and instantiate it
const fastify = require("fastify")({
	// set this to true for detailed logging:
	logger: false,
});

fastify.addContentTypeParser('*', function (req, payload, done) {
	done();
});

// Setup our static files
fastify.register(require("@fastify/static"), {
	root: path.join(__dirname, "public"),
	prefix: "/", // optional: default '/'
});

// fastify-formbody lets us parse incoming forms
fastify.register(require("@fastify/formbody"));

// point-of-view is a templating manager for fastify
fastify.register(require("@fastify/view"), {
	engine: {
		handlebars: require("handlebars"),
	},
});

// Our main GET home page route, pulls from src/pages/index.hbs
fastify.get("/", function (request, reply) {
	// params is an object we'll pass to our handlebars template
	let params = {
	};

	// request.query.paramName <-- a querystring example
	return reply.view("/src/pages/index.hbs", params);
});

// A POST route to handle form submissions
/*
 * A standard POST request to /upload should follow the following format as a query string and should include the file as the payload:
 * title: the name of the file (including extension)
 * author: the name of the person uploading the file
 */
fastify.post("/upload", (request, reply) => {
	return (new Promise(async (resolve) => {
		let id = Math.floor(Math.random()*Math.pow(10, 10)).toString();
		while (activeUploads[id]) {
			id = Math.floor(Math.random()*Math.pow(10, 10)).toString();
		}
		activeUploads[id] = { title: request.query.title, author: request.query.author, stream: new Stream.PassThrough({highWaterMark: 40000000}), parts: [] };
		discordUpload(id).then(async () => {
			const writter = await writeMeta(id);
			if (activeUploads.hasOwnProperty(id)) delete activeUploads[id];
			reply.code(200);
			resolve(reply.send(writter));
		}).catch(err => {
			reply.code(500);
			if (activeUploads.hasOwnProperty(id)) delete activeUploads[id];
			console.log(err);
			resolve(reply.send("Cancel"));
		});
		
		request.raw.pipe(activeUploads[id].stream, true);
		// request.raw.on("data", data => activeUploads[id].stream.write(data));
		// request.raw.on("end", () => activeUploads[id].stream.end());
		
	}));
	// reply.
});

fastify.get("/download/:fileid", (request, reply) => {
	const { fileid } = request.params;
	channel.messages.fetch(fileid).then(async metamessage => {
		const metadata = (await (await fetch(metamessage.attachments.first().url)).text()).split("\n");
		reply.code(200);
		reply.raw.setHeader("Content-Disposition", "attachment; filename=" + encodeURIComponent(Buffer.from(metadata[1], "base64").toString("utf8")));
		reply.raw.setHeader("Content-Type", "application/octet-stream");
		// metadata[4] is first content
		for (let x = 4; x < metadata.length - 1; x++) {
			reply.raw.write(await (await fetch((await (await client.channels.fetch(metadata[x].split("/")[0])).messages.fetch(metadata[x].split("/")[1])).attachments.first().url)).buffer());
		}
		reply.raw.end();
	}).catch(err => {
		console.log(err);
		reply.code(404);
		reply.send("Metadata message not found.");
	});

})

// Run the server and report out to the logs
DiscordPromise.then(() => {
	fastify.listen(
		{ port: process.env.PORT, host: "0.0.0.0" },
		function (err, address) {
			if (err) {
				fastify.log.error(err);
				process.exit(1);
			}
			console.log(`Your app is listening on ${address}`);
			fastify.log.info(`server listening on ${address}`);
		}
	);
});

async function discordUpload(id) {
	const upload = activeUploads[id];
	console.log("Waiting patiently...");
	await (new Promise((resolve) => upload.stream.once("readable", resolve)));
	upload.stream.on("readable", () => 1==1);
	console.log("Getting bored...");
	let finished = false;
	upload.stream.once("end", () => finished = true);
	while (!finished) {
		console.log("Waiting for a readable...");
		await (new Promise((resolve) => upload.stream.once("readable", resolve)));
		chunk = upload.stream.read(8388608);
		while (chunk) {
			console.log("Processing chunk!");
			if (i >= stores.size) {
				i = 0;
			}
			const chan = i;
			i++;
			const message = await stores.at(chan).send({
				files: [{
					attachment: chunk,
					name: "c",
					description: "Chunk"
				}]
			});
			// upload.parts.push(message.attachments.at(0).url)
			upload.parts.push(`${message.channelId}/${message.id}`);
			chunk = upload.stream.read(8388608);
			await sleep(250);
		}
	}
}
async function writeMeta(id) {
	const upload = activeUploads[id];
	let meta_string = `1\n${Buffer.from(upload.title, 'utf8').toString("base64")}\n${Date.now()/1000}\n${Buffer.from(upload.author, 'utf8').toString("base64")}\n`;
	upload.parts.forEach(seg => {
		meta_string += seg + "\n";
	});
	const message = await channel.send({
		files: [{
			attachment: Buffer.from(meta_string, 'utf8'),
			name: "m",
			description: "Chunk"
		}]
	});
	// return message.attachments.at(0).url;
	return `${message.id}`;
}