import 'dotenv/config';
import fs from 'fs';
import { Player } from 'discord-player';
import { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus } from '@discordjs/voice';
import yts from 'yt-search';
import
{
    Client,
    GatewayIntentBits,
    Partials,
    ActivityType,
    PermissionsBitField,
    EmbedBuilder
} from "discord.js";

const client = new Client( {
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.GuildVoiceStates
    ],
    partials: [
        Partials.User,
        Partials.Channel,
        Partials.Message,
        Partials.GuildMember,
        Partials.Reaction
    ]
} );
const player = new Player( client );
// ---------------- Data Storage ----------------
const DATA_FILE = './data.json';
let data = { warns: {}, xp: {} };

if ( fs.existsSync( DATA_FILE ) )
{
    const raw = fs.readFileSync( DATA_FILE );
    try
    {
        data = JSON.parse( raw );
        if ( !data.warns ) data.warns = {};
        if ( !data.xp ) data.xp = {};
    } catch ( e )
    {
        console.error( "❌ Failed to parse data.json, using defaults.", e );
        data = { warns: {}, xp: {} };
    }
}

function saveData ()
{
    try
    {
        fs.writeFileSync( DATA_FILE, JSON.stringify( data, null, 2 ) );
    } catch ( e )
    {
        console.error( "❌ Failed to save data.json", e );
    }
}

// ---------------- Helper: Get Log Channel ----------------
function getLogChannel ( guild )
{
    if ( !guild ) return null;
    return guild.channels.cache.find( ch => ch.name === "log" && ch.parent?.name === "admin" );
}

// ---------------- Helper: Create Log Embed ----------------
function createLogEmbed ( title, description, color, thumbnail = null, author = null )
{
    const embed = new EmbedBuilder()
        .setTitle( title )
        .setDescription( description )
        .setColor( color )
        .setTimestamp();
    if ( thumbnail )
    {
        embed.setThumbnail( thumbnail );
    }
    if ( author )
    {
        embed.setAuthor( { name: author.tag, iconURL: author.displayAvatarURL() } );
    }
    return embed;
}

// ---------------- XP System ----------------
function ensureGuildXP ( guildId )
{
    if ( !data.xp[ guildId ] ) data.xp[ guildId ] = {};
}

function addXP ( userId, guildId, amount )
{
    if ( !guildId ) return;
    ensureGuildXP( guildId );
    if ( !data.xp[ guildId ][ userId ] ) data.xp[ guildId ][ userId ] = { xp: 0 };
    data.xp[ guildId ][ userId ].xp += amount;
    saveData();
}

function getLevel ( xp )
{
    return Math.floor( 0.1 * Math.sqrt( xp ) );
}

// ---------------- Ready ----------------
client.once( 'ready', async () =>
{
    console.log( `✅ Logged in as ${ client.user.tag }` );
    client.user.setActivity( 'shbak-shbak', { type: ActivityType.Playing } );
    client.user.setStatus( 'dnd' );

    const commands = [
        {
            name: 'help',
            description: 'Show help message'
        },
        {
            name: 'clear',
            description: 'Clear messages in the channel',
            options: [
                { name: 'amount', type: 4, description: 'Number of messages (1-100)', required: true }
            ]
        },
        {
            name: 'timeout',
            description: 'Temporarily mute a member',
            options: [
                { name: 'user', type: 6, description: 'Select a member', required: true },
                { name: 'duration', type: 4, description: 'Duration in minutes', required: true },
                { name: 'reason', type: 3, description: 'Reason for timeout', required: false }
            ]
        },
        {
            name: 'kick',
            description: 'Kick a member',
            options: [
                { name: 'user', type: 6, description: 'Select a member', required: true },
                { name: 'reason', type: 3, description: 'Reason for kick', required: false }
            ]
        },
        {
            name: 'ban',
            description: 'Ban a member',
            options: [
                { name: 'user', type: 6, description: 'Select a member', required: true },
                { name: 'reason', type: 3, description: 'Reason for ban', required: false }
            ]
        },
        {
            name: "giveaway",
            description: "Manage giveaways",
            options: [
                {
                    name: "start",
                    description: "Start a giveaway",
                    type: 1,
                    options: [
                        { name: "duration", type: 4, description: "Duration in minutes", required: true },
                        { name: "prize", type: 3, description: "Prize for the giveaway", required: true }
                    ]
                },
                {
                    name: "end",
                    description: "End a giveaway manually",
                    type: 1,
                    options: [
                        { name: "messageid", type: 3, description: "Message ID of the giveaway", required: true }
                    ]
                }
            ]
        },
        {
            name: "rank",
            description: "Show your XP rank"
        },
        {
            name: "top",
            description: "Show top 10 members by XP"
        }

    ];

    const guildId = "YOUR_GUILD_ID"; // 🔑 replace with your server ID (or remove to only register globally)
    const guild = client.guilds.cache.get( guildId );
    if ( guild )
    {
        await guild.commands.set( commands );
        console.log( "✅ Slash commands registered for guild." );
    }

    await client.application.commands.set( commands );
    console.log( "🌍 Global slash commands registered." );
} );

// ---------------- Embed Generation Functions ----------------
function generateHelpEmbed ( client )
{
    return new EmbedBuilder()
        .setColor( 0x3498db )
        .setTitle( "🛠️ Shbak-shbak Bot Command List" )
        .setDescription( "I'm here to help you manage the server and have some fun! Here are the commands you can use:" )
        .setThumbnail( client.user.displayAvatarURL() )
        .addFields(
            { name: "General Commands", value: "`/help` - Shows this message.\n`/rank` - Displays your current XP and level.\n`/top` - Shows the server's top 10 leaderboard.", inline: true },
            { name: "Moderation", value: "`/clear <number>` - Deletes a specified number of messages.\n`/timeout <user> <min>` - Temporarily mutes a member.\n`/kick <user>` - Kicks a member from the server.\n`/ban <user>` - Bans a member from the server.", inline: true },
            { name: "Giveaway", value: "`/giveaway start <min> <prize>` - Starts a new giveaway.\n`/giveaway end <messageId>` - Manually ends an active giveaway.", inline: true }
        )
        .setFooter( { text: "Use these commands to make the server better! 🚀" } );
}

function generateRankEmbed ( user, userXP, rank, level )
{
    const nextLevelXP = Math.pow( ( level + 1 ) / 0.1, 2 );
    const progress = Math.min( 1, userXP / nextLevelXP );
    const filledBlocks = Math.floor( progress * 10 );
    const emptyBlocks = 10 - filledBlocks;
    const progressBar = "⬜".repeat( filledBlocks ) + "⬛".repeat( emptyBlocks );

    let rankColor = 0xf1c40f; // Default: gold
    if ( rank === 1 ) rankColor = 0xffd700; // Gold for 1st place
    else if ( rank > 1 && rank <= 3 ) rankColor = 0xc0c0c0; // Silver for 2nd/3rd place
    else rankColor = 0x2ecc71; // Green for others

    return new EmbedBuilder()
        .setColor( rankColor )
        .setTitle( `📊 ${ user.username }'s Rank` )
        .setThumbnail( user.displayAvatarURL() )
        .addFields(
            { name: "Current Level", value: `**${ level }**`, inline: true },
            { name: "Total XP", value: `**${ userXP }**`, inline: true },
            { name: "Server Rank", value: `**#${ rank }**`, inline: true }
        )
        .setDescription( `**Next Level Progress:**\n${ progressBar } ${ Math.floor( progress * 100 ) }%` )
        .setFooter( { text: `Need ${ nextLevelXP - userXP } XP to reach Level ${ level + 1 }!` } );
}

async function generateTopEmbed ( guild, sortedEntries )
{
    const embed = new EmbedBuilder()
        .setColor( 0x2ecc71 )
        .setTitle( "🏆 Top 10 XP Leaderboard" )
        .setThumbnail( guild.iconURL() )
        .setFooter( { text: "Can you make it to the top 10? Keep chatting! ✨" } );

    let rankList = "";
    const medals = [ "🥇", "🥈", "🥉" ];

    for ( let i = 0; i < sortedEntries.length; i++ )
    {
        const [ id, info ] = sortedEntries[ i ];
        const member = await guild.members.fetch( id ).catch( () => null );
        const name = member ? member.user.username : `Unknown User`;
        const level = getLevel( info.xp );
        const emoji = i < 3 ? medals[ i ] : `**#${ i + 1 }**`;
        rankList += `${ emoji } **${ name }** - Level ${ level } (${ info.xp } XP)\n`;
    }

    embed.setDescription( rankList );
    return embed;
}

// ---------------- Slash Commands & Interaction Handler ----------------
const giveaways = {};

client.on( 'interactionCreate', async interaction =>
{
    if ( !interaction.isCommand() ) return;
    const logChannel = getLogChannel( interaction.guild );

    // HELP
    if ( interaction.commandName === 'help' )
    {
        const helpEmbed = generateHelpEmbed( client );
        return interaction.reply( { embeds: [ helpEmbed ], ephemeral: true } );
    }

    // CLEAR
    if ( interaction.commandName === 'clear' )
    {
        if ( !interaction.member.permissions.has( PermissionsBitField.Flags.ManageMessages ) )
        {
            return interaction.reply( { content: "❌ You don't have permission to clear messages.", ephemeral: true } );
        }

        const amount = interaction.options.getInteger( 'amount' );
        if ( amount < 1 || amount > 100 )
        {
            return interaction.reply( { content: "❌ Number must be between 1 and 100.", ephemeral: true } );
        }

        const messages = await interaction.channel.messages.fetch( { limit: amount } );
        await interaction.channel.bulkDelete( messages );
        await interaction.reply( { content: `✅ Successfully deleted ${ messages.size } messages.`, ephemeral: true } );

        if ( logChannel )
        {
            const logEmbed = createLogEmbed(
                "🧹 Messages Cleared",
                `${ interaction.user.tag } deleted **${ messages.size }** messages in ${ interaction.channel }.`,
                0x3498db,
                interaction.user.displayAvatarURL()
            );
            logChannel.send( { embeds: [ logEmbed ] } );
        }
    }

    // TIMEOUT
    if ( interaction.commandName === 'timeout' )
    {
        if ( !interaction.member.permissions.has( PermissionsBitField.Flags.ModerateMembers ) )
        {
            return interaction.reply( { content: "❌ You don't have permission to timeout members.", ephemeral: true } );
        }

        const user = interaction.options.getUser( 'user' );
        const duration = interaction.options.getInteger( 'duration' );
        const reason = interaction.options.getString( 'reason' ) || "No reason provided";

        const member = await interaction.guild.members.fetch( user.id ).catch( () => null );
        if ( !member ) return interaction.reply( { content: "❌ Member not found.", ephemeral: true } );

        if ( !member.moderatable )
        {
            return interaction.reply( {
                content: `❌ I cannot timeout **${ user.tag }**.\n🔹 Check my role & permissions.`,
                ephemeral: true
            } );
        }

        const timeoutDuration = duration * 60 * 1000;
        await member.timeout( timeoutDuration, reason );
        await interaction.reply( { content: `⏱ **${ user.tag }** has been muted for **${ duration }** minutes.`, ephemeral: true } );

        if ( logChannel )
        {
            const logEmbed = createLogEmbed(
                "⏱️ Member Timed Out",
                `**User:** ${ user.tag } (${ user.id })\n**Moderator:** ${ interaction.user.tag }\n**Duration:** ${ duration } minutes\n**Reason:** ${ reason }`,
                0xf1c40f,
                user.displayAvatarURL(),
                interaction.user
            );
            logChannel.send( { embeds: [ logEmbed ] } );
        }

        try
        {
            await user.send( `⏱ You have been muted in **${ interaction.guild.name }** for **${ duration }** minutes.\nReason: ${ reason }` );
        } catch
        {
            if ( logChannel )
            {
                const logEmbed = createLogEmbed(
                    "❌ Timeout DM Failed",
                    `Failed to send a DM to ${ user.tag } about their timeout.`,
                    0xe74c3c
                );
                logChannel.send( { embeds: [ logEmbed ] } );
            }
        }
    }

    // KICK
    if ( interaction.commandName === 'kick' )
    {
        if ( !interaction.member.permissions.has( PermissionsBitField.Flags.KickMembers ) )
        {
            return interaction.reply( { content: "❌ You don't have permission to kick members.", ephemeral: true } );
        }

        const user = interaction.options.getUser( 'user' );
        const reason = interaction.options.getString( 'reason' ) || "No reason provided";
        const member = interaction.guild.members.cache.get( user.id );

        if ( !member ) return interaction.reply( { content: "❌ Member not found.", ephemeral: true } );
        if ( !member.kickable ) return interaction.reply( { content: "❌ Cannot kick this member.", ephemeral: true } );

        try { await user.send( `👢 You have been kicked from **${ interaction.guild.name }**.\nReason: ${ reason }` ); } catch { }
        await member.kick( reason );
        interaction.reply( { content: `👢 **${ user.tag }** has been kicked. Reason: ${ reason }`, ephemeral: true } );

        if ( logChannel )
        {
            const logEmbed = createLogEmbed(
                "👢 Member Kicked",
                `**User:** ${ user.tag } (${ user.id })\n**Moderator:** ${ interaction.user.tag }\n**Reason:** ${ reason }`,
                0xe67e22,
                user.displayAvatarURL(),
                interaction.user
            );
            logChannel.send( { embeds: [ logEmbed ] } );
        }
    }

    // BAN
    if ( interaction.commandName === 'ban' )
    {
        if ( !interaction.member.permissions.has( PermissionsBitField.Flags.BanMembers ) )
        {
            return interaction.reply( { content: "❌ You don't have permission to ban members.", ephemeral: true } );
        }

        const user = interaction.options.getUser( 'user' );
        const reason = interaction.options.getString( 'reason' ) || "No reason provided";
        const member = interaction.guild.members.cache.get( user.id );

        if ( !member ) return interaction.reply( { content: "❌ Member not found.", ephemeral: true } );
        if ( !member.bannable ) return interaction.reply( { content: "❌ Cannot ban this member.", ephemeral: true } );

        try { await user.send( `🚫 You have been banned from **${ interaction.guild.name }**.\nReason: ${ reason }` ); } catch { }
        await member.ban( { reason } );
        interaction.reply( { content: `🚫 **${ user.tag }** has been banned. Reason: ${ reason }`, ephemeral: true } );

        if ( logChannel )
        {
            const logEmbed = createLogEmbed(
                "🚫 Member Banned",
                `**User:** ${ user.tag } (${ user.id })\n**Moderator:** ${ interaction.user.tag }\n**Reason:** ${ reason }`,
                0xe74c3c,
                user.displayAvatarURL(),
                interaction.user
            );
            logChannel.send( { embeds: [ logEmbed ] } );
        }
    }

    // GIVEAWAY
    if ( interaction.commandName === "giveaway" )
    {
        const sub = interaction.options.getSubcommand();

        // START
        if ( sub === "start" )
        {
            const duration = interaction.options.getInteger( "duration" );
            const prize = interaction.options.getString( "prize" );

            const embed = new EmbedBuilder()
                .setTitle( "🎉 Giveaway Started!" )
                .setDescription( `**Prize:** ${ prize }\n\nReact with 🎉 to enter!\n\n**Ends:** <t:${ Math.floor( ( Date.now() + duration * 60 * 1000 ) / 1000 ) }:R>` )
                .setColor( 0x5865F2 )
                .setFooter( { text: "Giveaway System" } );

            const msg = await interaction.channel.send( { embeds: [ embed ] } );
            await msg.react( "🎉" );

            giveaways[ msg.id ] = {
                prize,
                endTime: Date.now() + duration * 60 * 1000,
                channelId: interaction.channel.id
            };

            interaction.reply( {
                content: `✅ Giveaway for **${ prize }** has started!`,
                ephemeral: true
            } );

            setTimeout( async () =>
            {
                const giveaway = giveaways[ msg.id ];
                if ( !giveaway ) return;

                const channel = await client.channels.fetch( giveaway.channelId );
                const message = await channel.messages.fetch( msg.id );

                const reactions = message.reactions.cache.get( "🎉" );
                const users = reactions ? await reactions.users.fetch() : null;
                const validUsers = users?.filter( u => !u.bot && !u.system ).map( u => u.id );
                const winner = validUsers?.length > 0 ? validUsers[ Math.floor( Math.random() * validUsers.length ) ] : null;

                if ( winner )
                {
                    channel.send( `🎉 Congratulations <@${ winner }>! You are the lucky winner of **${ giveaway.prize }**!` );
                } else
                {
                    channel.send( "❌ No valid entries, the giveaway has ended with no winner." );
                }

                delete giveaways[ msg.id ];
            }, duration * 60 * 1000 );

            interaction.guild.members.fetch().then( members =>
            {
                members.forEach( member =>
                {
                    if ( !member.user.bot )
                    {
                        member.send( `🎉 A new giveaway has started in **${ interaction.guild.name }**! 🎁\n**Prize:** **${ prize }**\nHead to the channel and react with 🎉 to enter here: ${ msg.url }` )
                            .catch( () => console.log( `❌ Couldn't DM ${ member.user.tag }` ) );
                    }
                } );
            } );
        }

        // END
        if ( sub === "end" )
        {
            const messageId = interaction.options.getString( "messageid" );
            const giveaway = giveaways[ messageId ];

            if ( !giveaway )
            {
                return interaction.reply( { content: "❌ Giveaway not found or already ended.", ephemeral: true } );
            }

            const channel = await client.channels.fetch( giveaway.channelId );
            const message = await channel.messages.fetch( messageId );

            const reactions = message.reactions.cache.get( "🎉" );
            const users = reactions ? await reactions.users.fetch() : null;
            const validUsers = users?.filter( u => !u.bot && !u.system ).map( u => u.id );
            const winner = validUsers?.length > 0 ? validUsers[ Math.floor( Math.random() * validUsers.length ) ] : null;

            if ( winner )
            {
                channel.send( `🎉 Congratulations <@${ winner }>! You are the lucky winner of **${ giveaway.prize }**!` );
            } else
            {
                channel.send( "❌ No valid entries, the giveaway has ended with no winner." );
            }

            delete giveaways[ messageId ];
            interaction.reply( { content: `✅ Giveaway ${ messageId } has been ended.`, ephemeral: true } );
        }
    }

    // ---------------- XP Commands: rank & top ----------------
    if ( interaction.commandName === "rank" )
    {
        if ( !interaction.guild ) return interaction.reply( { content: "❌ This command must be used in a server.", ephemeral: true } );

        const user = interaction.user;
        const guildId = interaction.guild.id;

        ensureGuildXP( guildId );

        if ( !data.xp[ guildId ][ user.id ] )
        {
            return interaction.reply( { content: "❌ You don't have any XP yet. Start chatting to gain some!", ephemeral: true } );
        }

        const userXP = data.xp[ guildId ][ user.id ].xp;
        const level = getLevel( userXP );

        const sorted = Object.entries( data.xp[ guildId ] )
            .sort( ( a, b ) => b[ 1 ].xp - a[ 1 ].xp )
            .map( ( [ id ] ) => id );

        const rank = sorted.indexOf( user.id ) + 1;
        const rankEmbed = generateRankEmbed( user, userXP, rank, level );

        return interaction.reply( { embeds: [ rankEmbed ], ephemeral: true } );
    }

    if ( interaction.commandName === "top" )
    {
        if ( !interaction.guild ) return interaction.reply( { content: "❌ This command must be used in a server.", ephemeral: true } );

        const guildId = interaction.guild.id;
        ensureGuildXP( guildId );

        const entries = Object.entries( data.xp[ guildId ] || {} );
        if ( entries.length === 0 )
        {
            return interaction.reply( { content: "❌ No XP data yet. Be the first to start chatting!", ephemeral: true } );
        }

        const sorted = entries
            .sort( ( a, b ) => b[ 1 ].xp - a[ 1 ].xp )
            .slice( 0, 10 );

        const topEmbed = await generateTopEmbed( interaction.guild, sorted );
        return interaction.reply( { embeds: [ topEmbed ] } );
    }
} );

// ---------------- Reply Bot + Warnings ----------------
function replyBot ( words, reply, search = true )
{
    client.on( 'messageCreate', async message =>
    {
        if ( message.author.bot ) return;
        if ( !message.guild ) return;

        let found = words.some( word =>
            ( search && message.content.toLowerCase().includes( word ) ) || ( !search && message.content.toLowerCase() === word )
        );

        if ( found )
        {
            await message.delete().catch( () => { } );
            const warningMessage = `🚫 **${ message.author.tag }**, please watch your language. This is warning #${ ( data.warns[ message.author.id ] || 0 ) + 1 }.`;
            message.channel.send( warningMessage );

            let userWarns = data.warns[ message.author.id ] || 0;
            userWarns++;
            data.warns[ message.author.id ] = userWarns;
            saveData();

            const logChannel = getLogChannel( message.guild );
            if ( logChannel )
            {
                const logEmbed = createLogEmbed(
                    "⚠️ Warning Issued",
                    `**User:** ${ message.author.tag } (${ message.author.id })\n**Reason:** Used a forbidden word.\n**Total Warnings:** ${ userWarns }/3`,
                    0xf39c12
                );
                logChannel.send( { embeds: [ logEmbed ] } );
            }

            try { await message.author.send( `⚠️ You received a warning in **${ message.guild.name }** for using a forbidden word. This is warning **#${ userWarns }** out of 3.` ); } catch { }

            if ( userWarns >= 3 )
            {
                const timeoutDuration = 15 * 60 * 1000;
                if ( message.member.moderatable )
                {
                    await message.member.timeout( timeoutDuration, "Reached 3 warnings" );
                    if ( logChannel )
                    {
                        const logEmbed = createLogEmbed(
                            "⏱️ User Timed Out",
                            `**User:** ${ message.author.tag }\n**Action:** Reached 3 warnings and was timed out for 15 minutes.`,
                            0xe74c3c
                        );
                        logChannel.send( { embeds: [ logEmbed ] } );
                    }
                } else if ( logChannel )
                {
                    const logEmbed = createLogEmbed(
                        "❌ Timeout Failed",
                        `Tried to timeout ${ message.author.tag } but I'm missing permissions.`,
                        0x95a5a6
                    );
                    logChannel.send( { embeds: [ logEmbed ] } );
                }
            }
        }
    } );
}

// ---------------- Bad Words ----------------
const badWords = [
    'fuck', 'shit', 'bitch', 'slut', 'dick', 'pussy', 'asshole', 'cunt', 'bastard', 'whore', 'motherfucker', 'sucker', 'idiot',
    'كسمك', 'شرموته', 'متناكه', 'متناك', 'كس امك', 'خول', 'كلب', 'كس', 'زب', 'طيز', 'منكوح', 'جزمه', 'بضان', 'قحبه', 'منيوك', 'ابن وسخة', 'يا ابن الوسخة', 'يا ابن المتناكة', 'ابو الزفت', 'جزمة', 'خخخ', 'هفأ', 'فاجرة', 'ابو العفاريت', 'ابو العك', 'ابو القرف', 'ابن الفاجرة', 'يا حيوان', 'عرص', 'كـس'
];
replyBot( badWords, '🚫 Watch your language!', true );

// ---------------- Message XP (per message) ----------------
const cooldown = new Map();

client.on( "messageCreate", message =>
{
    if ( message.author.bot || !message.guild ) return;

    // كل رسالة عادية تدي 5 XP
    addXP( message.author.id, message.guild.id, 5 );

    // لو الرسالة فيها صورة
    if ( message.attachments.size > 0 )
    {
        const key = `${ message.author.id }-${ message.guild.id }`;
        const now = Date.now();

        // لو أول مرة أو فات ساعة
        if ( !cooldown.has( key ) || now - cooldown.get( key ) >= 3600000 )
        {
            addXP( message.author.id, message.guild.id, 100 ); // +100 XP
            cooldown.set( key, now );

            // رسالة للمستخدم
            message.channel.send( `🎉 **${ message.author.username }**, لقد حصلت على 100 XP إضافية لنشر صورة!` ).then( msg =>
            {
                setTimeout( () => msg.delete().catch( () => { } ), 5000 ); // تمسح الرسالة بعد 5 ثواني
            } );
        }
    }
} );


// ---------------- Voice XP (per minute) ----------------
setInterval( () =>
{
    ( async () =>
    {
        try
        {
            for ( const [ guildId, guild ] of client.guilds.cache )
            {
                await guild.members.fetch().catch( () => { } );
                guild.members.cache.forEach( member =>
                {
                    if ( !member.user || member.user.bot ) return;
                    if ( member.voice?.channel && !member.voice.selfMute && !member.voice.selfDeaf )
                    {
                        addXP( member.id, guildId, 10 );
                    }
                } );
            }
        } catch ( e )
        {
            console.error( "Error during voice XP loop:", e );
        }
    } )();
}, 60 * 1000 );

client.login( process.env.TOKEN );  