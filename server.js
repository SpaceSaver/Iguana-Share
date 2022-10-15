const path = require("path");
const Stream = require("stream");
const { Client, Intents } = require("discord.js");
const client = new Client();
client.login(process.env["TOKEN"]);
let channel = null;
const DiscordPromise = new Promise((resolve) => {
	client.on("ready", async () => {
		channel = await client.channels.fetch(process.env["CHANNEL"]);
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
 * Line 2: File Name (str)
 * Line 3: Date uploaded (unix timestamp [long])
 * Line 4: Author (str)
 * Line 5-*: Segment URLs (str) (TODO: Make URLs shorter to save space)
 */

// Require the fastify framework and instantiate it
const fastify = require("fastify")({
	// set this to true for detailed logging:
	logger: false,
});

fastify.addContentTypeParser('*', function (req, done) {
	done()
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
	reply.code(200);
	let id = Math.floor(Math.random()*Math.pow(10, 10)).toString();
	while (activeUploads[id]) {
		id = Math.floor(Math.random()*Math.pow(10, 10)).toString();
	}
	activeUploads[id] = { title: request.query.title, author: request.query.author, stream: new Stream.PassThrough(), parts: [] };
	request.raw.pipe(activeUploads[id].stream, true);
	discordUpload(id);
	return 
	// reply.
});

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
	await (new Promise((resolve) => upload.stream.on("readable", resolve)));
	let chunk = upload.stream.read(8000000);
	while (chunk) {
		const message = await channel.send({
			files: [{
				attachment: chunk,
				name: "c",
				description: "Chunk"
			}]
		});
		upload.parts.push(message.attachments.at(0).url)
		chunk = upload.stream.read(8000000);
	}
}