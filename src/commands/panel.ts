///////////////////////////////////////
//STATS COMMAND
///////////////////////////////////////
import {opendiscord, api, utilities, openticketUtils} from "../index.js"
import * as discord from "discord.js"

const generalConfig = opendiscord.configs.get("opendiscord:general")
const panelMsgState = opendiscord.states.get("opendiscord:panel-message")

export async function registerCommandResponders(){
    //PANEL COMMAND RESPONDER
    opendiscord.responders.commands.add(new api.ODCommandResponder("opendiscord:panel",generalConfig.data.prefix,/^panel/))
    opendiscord.responders.commands.get("opendiscord:panel").workers.add([
        new api.ODWorker("opendiscord:panel",0,async (instance,params,origin,cancel) => {
            const {guild,channel,user,member} = instance
            
            //responder checks
            const hasPerms = await openticketUtils.replyHasPermissions(instance,origin,"panel")
            if (!hasPerms) return cancel()
            
            const isInGuild = await openticketUtils.replyIsInGuild(instance,origin)
            if (!isInGuild || !guild || channel.isDMBased()) return cancel()
            
            const ticket = await openticketUtils.replyIsTicket(instance,origin)
            if (!ticket) return cancel()
            
            const isAvailable = await openticketUtils.replyTicketIsAvailable(instance,origin,ticket)
            if (!isAvailable) return cancel()

            //fetch data
            const id = instance.options.getString("id",true)
            const panel = opendiscord.panels.get(id)
            if (!panel){
                instance.reply(await opendiscord.builders.messages.getSafe("opendiscord:error-panel-unknown").build(origin,{guild,channel,user}))
                return cancel()
            }
            
            await instance.reply(await opendiscord.builders.messages.getSafe("opendiscord:panel-ready").build(origin,{guild,channel,user,panel}))
            const panelMessage = await channel.send((await opendiscord.builders.messages.getSafe("opendiscord:panel").build(origin,{guild,channel,user,panel,isSubPanel:false})).message)
            if (panelMessage) await panelMsgState.setMsgState({channel,message:panelMessage},{
                messageOrigin:origin,
                panelId:panel.id.value,
                panelOptionIds:panel.get("opendiscord:options").value,
                panelAutoUpdate:(instance.options.getBoolean("auto-update",false) ?? false),
                isSubPanel:false
            },panelMessage.flags.has("Ephemeral"))
        }),
        new api.ODWorker("opendiscord:logs",-1,(instance,params,origin,cancel) => {
            opendiscord.log(instance.user.displayName+" used the 'panel' command!","info",[
                {key:"user",value:instance.user.username},
                {key:"userid",value:instance.user.id,hidden:true},
                {key:"channelid",value:instance.channel.id,hidden:true},
                {key:"method",value:origin}
            ])
        })
    ])
}

export async function registerButtonResponders(){
    //SUBPANEL OPTION BUTTON RESPONDER
    opendiscord.responders.buttons.add(new api.ODButtonResponder("opendiscord:subpanel-option",/^od:subpanel-option\|([^|]+)/))
    opendiscord.responders.buttons.get("opendiscord:subpanel-option").workers.add(
        new api.ODWorker("opendiscord:subpanel-option",0,async (instance,params,origin,cancel) => {
            const {guild,channel,user,message} = instance
            
            const match = /^od:subpanel-option\|([^|]+)/.exec(instance.interaction.customId)
            if (!match) return cancel()
            const optionId = match[1]

            //check message state
            const state = await panelMsgState.getMsgState({channel,message})
            if (!state){
                //TODO TRANSLATION!!!
                await instance.reply(await opendiscord.builders.messages.getSafe("opendiscord:error").build(origin,{guild,channel,user,error:"This panel is no longer valid or has expired. Create a new panel using `{0}` to solve the issue. It is normal to receive this error after a major Open Ticket update.".replace("{0}","/panel"),layout:"simple",customTitle:"Message State Expired"}))
                return cancel()
            }
            
            //responder checks
            const isInGuild = await openticketUtils.replyIsInGuild(instance,origin)
            if (!isInGuild || !guild || channel.isDMBased()) return cancel()

            //get option data
            const option = opendiscord.options.get(optionId)
            if (!option || !(option instanceof api.ODSubPanelOption)){
                instance.reply(await opendiscord.builders.messages.getSafe("opendiscord:error-option-unknown").build(origin,{guild:instance.guild,channel:instance.channel,user:instance.user}))
                return cancel()
            }

            //get panel data
            const subPanel = opendiscord.panels.get(option.get("opendiscord:panel-id").value)
            if (!subPanel){
                instance.reply(await opendiscord.builders.messages.getSafe("opendiscord:error-panel-unknown").build(origin,{guild,channel,user}))
                return cancel()
            }

            //send sub-panel message (ephemeral)
            const panelMessage = await instance.reply((await opendiscord.builders.messages.getSafe("opendiscord:panel").build("sub-panel",{guild,channel,user,panel:subPanel,isSubPanel:true})))
            if (panelMessage.success) await panelMsgState.setMsgState({channel,message:panelMessage.message},{
                messageOrigin:"sub-panel",
                panelId:subPanel.id.value,
                panelOptionIds:subPanel.get("opendiscord:options").value,
                panelAutoUpdate:false,
                isSubPanel:true
            },panelMessage.ephemeral)

            opendiscord.log(instance.user.displayName+" created a sub-panel!","info",[
                {key:"user",value:instance.user.username},
                {key:"userid",value:instance.user.id,hidden:true},
                {key:"channelid",value:instance.channel.id,hidden:true},
                {key:"method",value:origin}
            ])
        })
    )
}