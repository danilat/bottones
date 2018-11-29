const path = require('path');
const restify = require('restify');

const { BotFrameworkAdapter, MemoryStorage, ConversationState, TurnContext } = require('botbuilder');
const { BotConfiguration } = require('botframework-config');

const ENV_FILE = path.join(__dirname, '.env');
const env = require('dotenv').config({path: ENV_FILE});

const DEV_ENVIRONMENT = 'development';

const BOT_CONFIGURATION = (process.env.NODE_ENV || DEV_ENVIRONMENT);

// Create HTTP server
let server = restify.createServer();
server.use(restify.plugins.bodyParser());
server.listen(process.env.port || process.env.PORT || 3978, function () {
    console.log(`\n${server.name} listening to ${server.url}`);
    console.log(`\nGet Bot Framework Emulator: https://aka.ms/botframework-emulator`);
    console.log(`\nTo talk to your bot, open bottones.bot file in the Emulator`);
});

const BOT_FILE = path.join(__dirname, (process.env.botFilePath || ''));

let botConfig;
try {
    botConfig = BotConfiguration.loadSync(BOT_FILE, process.env.botFileSecret);
} catch (err) {
    console.error(`\nError reading bot file. Please ensure you have valid botFilePath and botFileSecret set for your environment.`);
    console.error(`\n - The botFileSecret is available under appsettings for your Azure Bot Service bot.`);
    console.error(`\n - If you are running this bot locally, consider adding a .env file with botFilePath and botFileSecret.\n\n`);
    process.exit();
}

// Get bot endpoint configuration by service name
const endpointConfig = botConfig.findServiceByNameOrId(BOT_CONFIGURATION);

// Create adapter.
// See https://aka.ms/about-bot-adapter to learn more about .bot file its use and bot configuration .
const adapter = new BotFrameworkAdapter({
    appId: endpointConfig.appId || process.env.microsoftAppID,
    appPassword: endpointConfig.appPassword || process.env.microsoftAppPassword
});

// Define state store for your bot.
// See https://aka.ms/about-bot-state to learn more about bot state.
const storage = new MemoryStorage();
// CAUTION: You must ensure your product environment has the NODE_ENV set
//          to use the Azure Blob storage or Azure Cosmos DB providers.
// const { BlobStorage } = require('botbuilder-azure');
// Storage configuration name or ID from .bot file
// const STORAGE_CONFIGURATION_ID = '<STORAGE-NAME-OR-ID-FROM-BOT-FILE>';
// // Default container name
// const DEFAULT_BOT_CONTAINER = '<DEFAULT-CONTAINER>';
// // Get service configuration
// const blobStorageConfig = botConfig.findServiceByNameOrId(STORAGE_CONFIGURATION_ID);
// const blobStorage = new BlobStorage({
//     containerName: (blobStorageConfig.container || DEFAULT_BOT_CONTAINER),
//     storageAccountOrConnectionString: blobStorageConfig.connectionString,
// });
// conversationState = new ConversationState(blobStorage);

// Create conversation state with in-memory storage provider.
const conversationState = new ConversationState(storage);

// Listen for incoming requests.
server.post('/api/messages', (req, res) => {
    adapter.processActivity(req, res, async (context) => {
      const reference = TurnContext.getConversationReference(context.activity);
      storeReference(reference)
      sendMessageToUser(`Welcome to Bottones! :)`, reference)
    });
});

server.post('/api/notifyUser', async (req, res) => {
  if(req.body){
    const alert = JSON.parse(req.body)
    const reference = await findReference(alert.userId)
    if(reference){
      sendMessageToUser(alert.message, reference)
      res.send(200);
      return
    }
  }
  res.send(404);
})

async function storeReference(reference){
  const item = {}
  const userId = reference.user.id
  item[userId] = {reference: reference}
  item[userId].eTag = "*"
  await storage.write(item);
}
async function findReference(userId){
  const items = await storage.read([userId])
  const reference = userId in items ? items[userId].reference : {};
  return reference
}

function sendMessageToUser(message, reference) {
  adapter.continueConversation(reference, async (ctx) => {
     await ctx.sendActivity(message);
  });
}
