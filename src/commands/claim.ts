///////////////////////////////////////
//CLAIM COMMAND
///////////////////////////////////////
import {opendiscord, api, utilities} from "../index.js"
import * as discord from "discord.js"

const generalConfig = opendiscord.configs.get("opendiscord:general")

export const registerCommandResponders = async () => {
    //CLAIM COMMAND RESPONDER
    opendiscord.responders.commands.add(new api.ODCommandResponder("opendiscord:claim",generalConfig.data.prefix,"claim"))
    opendiscord.responders.commands.get("opendiscord:claim").workers.add([
        new api.ODWorker("opendiscord:claim",0,async (instance,params,origin,cancel) => {
            const {guild,channel,user,member} = instance

            //check permissions
            const permsResult = await opendiscord.permissions.checkCommandPerms(generalConfig.data.system.permissions.claim,"support",user,member,channel,guild)
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

            //return when already claimed
            if (ticket.get("opendiscord:claimed").value){
                instance.reply(await opendiscord.builders.messages.getSafe("opendiscord:error").build("button",{guild,channel,user,error:opendiscord.languages.getTranslation("errors.actionInvalid.claim"),layout:"simple"}))
                return cancel()
            }

            //return when busy
            if (ticket.get("opendiscord:busy").value){
                instance.reply(await opendiscord.builders.messages.getSafe("opendiscord:error-ticket-busy").build("button",{guild,channel,user}))
                return cancel()
            }

            const claimUser = instance.options.getUser("user",false) ?? user
            const reason = instance.options.getString("reason",false)

            //start claiming ticket
            await instance.defer(false)
            await opendiscord.actions.get("opendiscord:claim-ticket").run(origin,{guild,channel,user:claimUser,ticket,reason,sendMessage:false})
            await instance.reply(await opendiscord.builders.messages.getSafe("opendiscord:claim-message").build(origin,{guild,channel,user:claimUser,ticket,reason}))
        }),
        new api.ODWorker("opendiscord:logs",-1,(instance,params,origin,cancel) => {
            opendiscord.log(instance.user.displayName+" used the 'claim' command!","info",[
                {key:"user",value:instance.user.username},
                {key:"userid",value:instance.user.id,hidden:true},
                {key:"channelid",value:instance.channel.id,hidden:true},
                {key:"method",value:origin}
            ])
        })
    ])
}

export const registerButtonResponders = async () => {
    //CLAIM TICKET BUTTON RESPONDER
    opendiscord.responders.buttons.add(new api.ODButtonResponder("opendiscord:claim-ticket",/^od:claim-ticket/))
    opendiscord.responders.buttons.get("opendiscord:claim-ticket").workers.add(
        new api.ODWorker("opendiscord:claim-ticket",0,async (instance,params,origin,cancel) => {
            const originalOrigin = instance.interaction.customId.split("_")[1] as Exclude<api.ODActionManagerIdMappings["opendiscord:claim-ticket"]["origin"],"slash"|"text">
            
            if (originalOrigin == "ticket-message") await opendiscord.verifybars.get("opendiscord:claim-ticket-ticket-message").activate(instance)
            else if (originalOrigin == "unclaim-message") await opendiscord.verifybars.get("opendiscord:claim-ticket-unclaim-message").activate(instance)
            else await instance.defer("update",false)
        })
    )
}

export const registerModalResponders = async () => {
    //CLAIM WITH REASON MODAL RESPONDER
    opendiscord.responders.modals.add(new api.ODModalResponder("opendiscord:claim-ticket-reason",/^od:claim-ticket-reason_/))
    opendiscord.responders.modals.get("opendiscord:claim-ticket-reason").workers.add([
        new api.ODWorker("opendiscord:claim-ticket-reason",0,async (instance,params,origin,cancel) => {
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

            const originalOrigin = instance.interaction.customId.split("_")[2] as Exclude<api.ODActionManagerIdMappings["opendiscord:claim-ticket"]["origin"],"slash"|"text">
            const reason = instance.values.getTextField("reason",true)

            //claim with reason
            if (originalOrigin == "ticket-message"){
                await instance.defer("update",false)
                await opendiscord.actions.get("opendiscord:claim-ticket").run(originalOrigin,{guild,channel,user,ticket,reason,sendMessage:true})
                await instance.update(await opendiscord.builders.messages.getSafe("opendiscord:ticket-message").build("other",{guild,channel,user,ticket}))
            }else if (originalOrigin == "unclaim-message"){
                await instance.defer("update",false)
                await opendiscord.actions.get("opendiscord:claim-ticket").run(originalOrigin,{guild,channel,user,ticket,reason,sendMessage:false})
                await instance.update(await opendiscord.builders.messages.getSafe("opendiscord:claim-message").build("other",{guild,channel,user,ticket,reason}))
            }else{
                await instance.defer("update",false)
                await opendiscord.actions.get("opendiscord:claim-ticket").run(originalOrigin,{guild,channel,user,ticket,reason,sendMessage:true})
            }
            
        })
    ])
}