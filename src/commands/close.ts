///////////////////////////////////////
//CLOSE COMMAND
///////////////////////////////////////
import {opendiscord, api, utilities} from "../index.js"
import * as discord from "discord.js"

const generalConfig = opendiscord.configs.get("opendiscord:general")
const lang = opendiscord.languages

export const registerCommandResponders = async () => {
    //CLOSE COMMAND RESPONDER
    opendiscord.responders.commands.add(new api.ODCommandResponder("opendiscord:close",generalConfig.data.prefix,"close"))
    opendiscord.responders.commands.get("opendiscord:close").workers.add([
        new api.ODWorker("opendiscord:close",0,async (instance,params,origin,cancel) => {
            const {user,member,channel,guild} = instance

            //check permissions
            const permsResult = await opendiscord.permissions.checkCommandPerms(generalConfig.data.system.permissions.close,"support",user,member,channel,guild)
            if (!permsResult.hasPerms){
                if (permsResult.reason == "not-in-server") await instance.reply(await opendiscord.builders.messages.getSafe("opendiscord:error-not-in-guild").build("button",{channel,user}))
                else await instance.reply(await opendiscord.builders.messages.getSafe("opendiscord:error-no-permissions").build(origin,{guild,channel,user,permissions:["support"]}))
                return cancel()
            }

            //check is in guild/server
            if (!guild){
                instance.reply(await opendiscord.builders.messages.getSafe("opendiscord:error-not-in-guild").build("button",{channel,user}))
                return cancel()
            }

            //check if ticket exists
            const ticket = opendiscord.tickets.get(channel.id)
            if (!ticket || channel.isDMBased()){
                instance.reply(await opendiscord.builders.messages.getSafe("opendiscord:error-ticket-unknown").build("button",{guild,channel,user}))
                return cancel()
            }

            //return when already closed
            if (ticket.get("opendiscord:closed").value){
                instance.reply(await opendiscord.builders.messages.getSafe("opendiscord:error").build("button",{guild,channel,user,error:opendiscord.languages.getTranslation("errors.actionInvalid.close"),layout:"simple"}))
                return cancel()
            }

            //return when busy
            if (ticket.get("opendiscord:busy").value){
                instance.reply(await opendiscord.builders.messages.getSafe("opendiscord:error-ticket-busy").build("button",{guild,channel,user}))
                return cancel()
            }

            //return when not allowed because of missing messages
            if (!permsResult.isAdmin && (!generalConfig.data.system.allowCloseBeforeMessage || !generalConfig.data.system.allowCloseBeforeAdminMessage)){
                const analysis = await opendiscord.transcripts.collector.ticketUserMessagesAnalysis(ticket,guild,channel)
                if (analysis && !generalConfig.data.system.allowCloseBeforeMessage && analysis.totalMessages < 1){
                    instance.reply(await opendiscord.builders.messages.getSafe("opendiscord:error").build("button",{guild,channel,user,layout:"simple",error:lang.getTranslation("errors.descriptions.closeBeforeMessage"),customTitle:lang.getTranslation("errors.titles.noPermissions")}))
                    return cancel()
                }
                if (analysis && !generalConfig.data.system.allowCloseBeforeAdminMessage && analysis.adminMessages < 1){
                    instance.reply(await opendiscord.builders.messages.getSafe("opendiscord:error").build("button",{guild,channel,user,layout:"simple",error:lang.getTranslation("errors.descriptions.closeBeforeAdminMessage"),customTitle:lang.getTranslation("errors.titles.noPermissions")}))
                    return cancel()
                }
            }
            
            //start closing ticket
            await instance.defer(false)
            const reason = instance.options.getString("reason",false)
            await opendiscord.actions.get("opendiscord:close-ticket").run(origin,{guild,channel,user,ticket,reason,sendMessage:false})
            await instance.reply(await opendiscord.builders.messages.getSafe("opendiscord:close-message").build(origin,{guild,channel,user,ticket,reason}))
        }),
        new api.ODWorker("opendiscord:logs",-1,(instance,params,origin,cancel) => {
            opendiscord.log(instance.user.displayName+" used the 'close' command!","info",[
                {key:"user",value:instance.user.username},
                {key:"userid",value:instance.user.id,hidden:true},
                {key:"channelid",value:instance.channel.id,hidden:true},
                {key:"method",value:origin}
            ])
        })
    ])
}

export const registerButtonResponders = async () => {
    //CLOSE TICKET BUTTON RESPONDER
    opendiscord.responders.buttons.add(new api.ODButtonResponder("opendiscord:close-ticket",/^od:close-ticket_/))
    opendiscord.responders.buttons.get("opendiscord:close-ticket").workers.add(
        new api.ODWorker("opendiscord:close-ticket",0,async (instance,params,origin,cancel) => {
            const originalOrigin = instance.interaction.customId.split("_")[1] as Exclude<api.ODActionManagerIdMappings["opendiscord:close-ticket"]["origin"],"slash"|"text"|"autoclose">
            
            if (originalOrigin == "ticket-message") await opendiscord.verifybars.get("opendiscord:close-ticket-ticket-message").activate(instance)
            else if (originalOrigin == "reopen-message") await opendiscord.verifybars.get("opendiscord:close-ticket-reopen-message").activate(instance)
            else await instance.defer("update",false)
        })
    )
}

export const registerModalResponders = async () => {
    //CLOSE WITH REASON MODAL RESPONDER
    opendiscord.responders.modals.add(new api.ODModalResponder("opendiscord:close-ticket-reason",/^od:close-ticket-reason_/))
    opendiscord.responders.modals.get("opendiscord:close-ticket-reason").workers.add([
        new api.ODWorker("opendiscord:close-ticket-reason",0,async (instance,params,origin,cancel) => {
            const {guild,channel,user} = instance
            if (!channel) return
            if (!guild){
                //error
                instance.reply(await opendiscord.builders.messages.getSafe("opendiscord:error-not-in-guild").build(origin,{channel,user:instance.user}))
                return cancel()
            }
            const ticket = opendiscord.tickets.get(instance.interaction.customId.split("_")[1])
            if (!ticket || channel.isDMBased()){
                instance.reply(await opendiscord.builders.messages.getSafe("opendiscord:error-ticket-unknown").build("button",{guild,channel,user}))
                return
            }

            const originalOrigin = instance.interaction.customId.split("_")[2] as Exclude<api.ODActionManagerIdMappings["opendiscord:close-ticket"]["origin"],"slash"|"text"|"autoclose">
            const reason = instance.values.getTextField("reason",true)

            //close with reason
            if (originalOrigin == "ticket-message"){
                await instance.defer("update",false)
                await opendiscord.actions.get("opendiscord:close-ticket").run(originalOrigin,{guild,channel,user,ticket,reason,sendMessage:true})
                await instance.update(await opendiscord.builders.messages.getSafe("opendiscord:ticket-message").build("other",{guild,channel,user,ticket}))
            }else if (originalOrigin == "reopen-message"){
                await instance.defer("update",false)
                await opendiscord.actions.get("opendiscord:close-ticket").run(originalOrigin,{guild,channel,user,ticket,reason,sendMessage:false})
                await instance.update(await opendiscord.builders.messages.getSafe("opendiscord:close-message").build("other",{guild,channel,user,ticket,reason}))
            }else{
                await instance.defer("update",false)
                await opendiscord.actions.get("opendiscord:close-ticket").run(originalOrigin,{guild,channel,user,ticket,reason,sendMessage:true})
            }
            
        })
    ])
}