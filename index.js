const {
    Client,
    GatewayIntentBits,
    REST,
    Routes,
    SlashCommandBuilder,
    EmbedBuilder
} = require("discord.js");

// ===============================
// CONFIG
// ===============================
const TOKEN = process.env.TOKEN;
const APP_ID = process.env.APP_ID;
const GUILD_ID = "1428484101920522332";

const BOT_AVATAR = "https://files.catbox.moe/g1rl6l.png";

// Rank ladder in order (lowest ➝ highest)
const rankLadder = [
    "1435712249632395284", // Jr Helper
    "1429589525994143804", // Helper
    "1435708793865375994", // Sr Helper
    "1435707869763735713", // Jr Mod
    "1429594309417504868", // Mod
    "1435709346054017206", // Sr Mod
    "1429594418440306699", // Admin
    "1436300684155682816", // Sr Admin
    "1436341287887573032", // Head Admin
    "1429594480721399971"  // Manager
];

// Who can use commands
const allowedRoles = [
    "1431945711888371815", // Staff Manager
    "1431257293328089179", // Owner
    "1429138176433193071"  // Founder
];

// Log channel
const LOG_CHANNEL = "1429593498365198502";

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers
    ]
});

// ===============================
// REGISTER COMMANDS
// ===============================
const commands = [
    new SlashCommandBuilder()
        .setName("promote")
        .setDescription("Promotes a staff member to the next rank.")
        .addUserOption(opt => opt.setName("user").setDescription("User to promote").setRequired(true)),

    new SlashCommandBuilder()
        .setName("demote")
        .setDescription("Demotes a staff member to the previous rank.")
        .addUserOption(opt => opt.setName("user").setDescription("User to demote").setRequired(true))
].map(cmd => cmd.toJSON());

const rest = new REST({ version: "10" }).setToken(TOKEN);

(async () => {
    console.log("Registering commands...");
    await rest.put(
        Routes.applicationGuildCommands(APP_ID, GUILD_ID),
        { body: commands }
    );
    console.log("Slash commands registered!");
})();

// ===============================
// HELPERS
// ===============================

// Find user's current staff rank index
function getRankIndex(member) {
    for (let i = 0; i < rankLadder.length; i++) {
        if (member.roles.cache.has(rankLadder[i])) {
            return i;
        }
    }
    return -1;
}

function getRankName(id, guild) {
    return guild.roles.cache.get(id)?.name || "Unknown Rank";
}

// NEW nickname format: Rank | Username
async function updateNickname(member, newRankName) {
    const username = member.user.username;
    const newNick = `${newRankName} | ${username}`.slice(0, 32);

    await member.setNickname(newNick).catch(() => {});
}

// Remove all staff roles except the correct one
async function cleanupRanks(member, keepRole) {
    for (const role of rankLadder) {
        if (role !== keepRole && member.roles.cache.has(role)) {
            await member.roles.remove(role).catch(() => {});
        }
    }
}

function makeEmbed(title, desc) {
    return new EmbedBuilder()
        .setTitle(title)
        .setDescription(desc)
        .setColor("#00A8FF")
        .setThumbnail(BOT_AVATAR)
        .setFooter({ text: "Staff Management System", iconURL: BOT_AVATAR })
        .setTimestamp();
}

// ===============================
// COMMAND HANDLING
// ===============================
client.on("interactionCreate", async interaction => {
    if (!interaction.isChatInputCommand()) return;

    const guild = interaction.guild;
    const author = interaction.member;

    // Permission check
    if (!allowedRoles.some(r => author.roles.cache.has(r))) {
        return interaction.reply({
            content: "❌ You are NOT allowed to use staff commands.",
            ephemeral: true
        });
    }

    const target = interaction.options.getMember("user");
    if (!target) return interaction.reply("❌ User not found.");

    const index = getRankIndex(target);

    // ============ PROMOTE ============
    if (interaction.commandName === "promote") {

        if (index === -1)
            return interaction.reply("❌ That user has **no staff rank**.");

        if (index === rankLadder.length - 1)
            return interaction.reply("❌ Already at **highest rank**.");

        const oldRank = rankLadder[index];
        const newRank = rankLadder[index + 1];

        await cleanupRanks(target, newRank);
        await target.roles.add(newRank).catch(() => {});

        const newRankName = getRankName(newRank, guild);
        await updateNickname(target, newRankName);

        // Log
        guild.channels.cache.get(LOG_CHANNEL)?.send({
            embeds: [
                makeEmbed("📈 Promotion",
                    `**User:** ${target}\n**Old Rank:** ${getRankName(oldRank, guild)}\n**New Rank:** ${newRankName}\n**By:** ${author}`)
            ]
        });

        // DM
        target.send({
            embeds: [
                makeEmbed("🎉 You Were Promoted!",
                    `You are now **${newRankName}** in ${guild.name}!`)
            ]
        }).catch(() => {});

        return interaction.reply({
            embeds: [
                makeEmbed("Promotion Complete",
                    `Promoted ${target} → **${newRankName}**`)
            ]
        });
    }

    // ============ DEMOTE ============
    if (interaction.commandName === "demote") {

        if (index === -1)
            return interaction.reply("❌ That user has **no staff rank**.");

        if (index === 0)
            return interaction.reply("❌ Already at **lowest rank**.");

        const oldRank = rankLadder[index];
        const newRank = rankLadder[index - 1];

        await cleanupRanks(target, newRank);
        await target.roles.add(newRank).catch(() => {});

        const newRankName = getRankName(newRank, guild);
        await updateNickname(target, newRankName);

        // Log
        guild.channels.cache.get(LOG_CHANNEL)?.send({
            embeds: [
                makeEmbed("📉 Demotion",
                    `**User:** ${target}\n**Old Rank:** ${getRankName(oldRank, guild)}\n**New Rank:** ${newRankName}\n**By:** ${author}`)
            ]
        });

        // DM
        target.send({
            embeds: [
                makeEmbed("⚠️ You Were Demoted",
                    `You are now **${newRankName}** in ${guild.name}.`)
            ]
        }).catch(() => {});

        return interaction.reply({
            embeds: [
                makeEmbed("Demotion Complete",
                    `Demoted ${target} → **${newRankName}**`)
            ]
        });
    }
});

client.once("ready", () => {
    console.log(`Logged in as ${client.user.tag}`);
});

client.login(TOKEN);
