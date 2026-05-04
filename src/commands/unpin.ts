///////////////////////////////////////
//UNPIN COMMAND
///////////////////////////////////////
import {opendiscord, api, utilities} from "../index.js"
import * as discord from "discord.js"

const generalConfig = opendiscord.configs.get("opendiscord:general")

export const registerCommandResponders = async () => {
    //UNPIN COMMAND RESPONDER
    opendiscord.responders.commands.add(new api.ODCommandResponder("opendiscord:unpin",generalConfig.data.prefix,"unpin"))
    opendiscord.responders.commands.get("opendiscord:unpin").workers.add([
        new api.ODWorker("opendiscord:unpin",0,async (instance,params,origin,cancel) => {
            const {user,member,channel,guild} = instance
                                    
            //check permissions
            const permsResult = await opendiscord.permissions.checkCommandPerms(generalConfig.data.system.permissions.unpin,"support",user,member,channel,guild)
            if (!permsResult.hasPerms){
                if (permsResult.reason == "not-in-server") await instance.reply(await opendiscord.builders.messages.getSafe("opendiscord:error-not-in-guild").build("button",{channel,user}))
                else await instance.reply(await opendiscord.builders.messages.getSafe("opendiscord:error-no-permissions").build(origin,{guild,channel,user,permissions:["support"]}))
                return cancel()
            }

            //check is in guild/Server
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

            //return when not pinned yet
            if (!ticket.get("opendiscord:pinned").value){
                instance.reply(await opendiscord.builders.messages.getSafe("opendiscord:error").build("button",{guild,channel,user,error:opendiscord.languages.getTranslation("errors.actionInvalid.unpin"),layout:"simple"}))
                return cancel()
            }
            
            //return when busy
            if (ticket.get("opendiscord:busy").value){
                instance.reply(await opendiscord.builders.messages.getSafe("opendiscord:error-ticket-busy").build("button",{guild,channel,user}))
                return cancel()
            }

            const reason = instance.options.getString("reason",false)

            //start unpinning ticket
            await instance.defer(false)
            await opendiscord.actions.get("opendiscord:unpin-ticket").run(origin,{guild,channel,user,ticket,reason,sendMessage:false})
            await instance.reply(await opendiscord.builders.messages.getSafe("opendiscord:unpin-message").build(origin,{guild,channel,user,ticket,reason}))
        }),
        new api.ODWorker("opendiscord:logs",-1,(instance,params,origin,cancel) => {
            opendiscord.log(instance.user.displayName+" used the 'unpin' command!","info",[
                {key:"user",value:instance.user.username},
                {key:"userid",value:instance.user.id,hidden:true},
                {key:"channelid",value:instance.channel.id,hidden:true},
                {key:"method",value:origin}
            ])
        })
    ])
}

export const registerButtonResponders = async () => {
    //UNPIN TICKET BUTTON RESPONDER
    opendiscord.responders.buttons.add(new api.ODButtonResponder("opendiscord:unpin-ticket",/^od:unpin-ticket/))
    opendiscord.responders.buttons.get("opendiscord:unpin-ticket").workers.add(
        new api.ODWorker("opendiscord:unpin-ticket",0,async (instance,params,origin,cancel) => {
            const originalOrigin = instance.interaction.customId.split("_")[1] as Exclude<api.ODActionManagerIdMappings["opendiscord:unpin-ticket"]["origin"],"slash"|"text">
            
            if (originalOrigin == "ticket-message") await opendiscord.verifybars.get("opendiscord:unpin-ticket-ticket-message").activate(instance)
            else if (originalOrigin == "pin-message") await opendiscord.verifybars.get("opendiscord:unpin-ticket-pin-message").activate(instance)
            else await instance.defer("update",false)
        })
    )
}

export const registerModalResponders = async () => {
    //UNPIN WITH REASON MODAL RESPONDER
    opendiscord.responders.modals.add(new api.ODModalResponder("opendiscord:unpin-ticket-reason",/^od:unpin-ticket-reason_/))
    opendiscord.responders.modals.get("opendiscord:unpin-ticket-reason").workers.add([
        new api.ODWorker("opendiscord:unpin-ticket-reason",0,async (instance,params,origin,cancel) => {
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

            const originalOrigin = instance.interaction.customId.split("_")[2] as Exclude<api.ODActionManagerIdMappings["opendiscord:unpin-ticket"]["origin"],"slash"|"text">
            const reason = instance.values.getTextField("reason",true)

            //unpin with reason
            if (originalOrigin == "ticket-message"){
                await instance.defer("update",false)
                await opendiscord.actions.get("opendiscord:unpin-ticket").run(originalOrigin,{guild,channel,user,ticket,reason,sendMessage:true})
                await instance.update(await opendiscord.builders.messages.getSafe("opendiscord:ticket-message").build("other",{guild,channel,user,ticket}))
            }else if (originalOrigin == "pin-message"){
                await instance.defer("update",false)
                await opendiscord.actions.get("opendiscord:unpin-ticket").run(originalOrigin,{guild,channel,user,ticket,reason,sendMessage:false})
                await instance.update(await opendiscord.builders.messages.getSafe("opendiscord:unpin-message").build("other",{guild,channel,user,ticket,reason}))
            }else{
                await instance.defer("update",false)
                await opendiscord.actions.get("opendiscord:unpin-ticket").run(originalOrigin,{guild,channel,user,ticket,reason,sendMessage:true})
            }
        })
    ])
}