import { MessageModel } from "../models/message.model.js";
import { ConversationModel } from "../models/converstaion.model.js";
import { ProjectModel } from "../models/project.model.js";
import type { NextFunction, Request, Response } from "express";
import { getConversationTitle } from "../service/ai/ai.service.js";
import { handleUserMessage } from "../service/ai/ai.service.js";
import { HumanMessage, AIMessage, ToolMessage, AIMessageChunk } from "langchain";

export async function handleMessageController(req: Request, res: Response, next: NextFunction) {

    const user = req.user;
    let conversation = null;

    if (!user) {
        return res.status(401).json({ error: "Unauthorized" });
    }

    const project = await ProjectModel.findOne({ projectId: req.body.projectId, userId: user.id });

    if (!project) {
        return res.status(404).json({ error: "Project not found" });
    }


    if (req.body.conversationId) {
        conversation = await ConversationModel.findOne({ _id: req.body.conversationId }); //purani chat continue karo

        if (!conversation) {
            return res.status(404).json({ error: "Conversation not found" });
        }

        if (conversation.project?.toString() !== project.id) {
            return res.status(403).json({ error: "Conversation does not belong to the project" });
        }

        if (conversation.user?.toString() !== user.id) {
            return res.status(403).json({ error: "Conversation does not belong to the user" });
        }
    } else { //nayi chat banao

        const title = await getConversationTitle(req.body.content);

        conversation = await ConversationModel.create({
            title,
            project: project.id,
            user: user.id
        })
    }


    // –––––––––––––––––––– Conversation Headers –––––––––––––––––––
    res.setHeader('X-Conversation-Id', conversation.id);
    res.setHeader('X-Conversation-Title', conversation.title);
    res.setHeader('Access-Control-Expose-Headers', 'X-Conversation-Id, X-Conversation-Title');


    // ––––––––––––––––––– SSE Headers –––––––––––––––––––
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");


     await MessageModel.create({
        conversationId: conversation.id, //Message kis chat ka hai
        author: "user", //Ye message user ne bheja hai
        content: req.body.content, //User ka actual message
        toolCalls: [] //Is user message mein AI ke tool calls nahi hain
    })

    const messages = await MessageModel.find({ conversationId: conversation.id }) //Backend poori conversation ki history database se nikalta hai.
        .sort({ createdAt: 1, _id: 1 });

    const history = messages.map(message => {
            if (message.author === "user") {
                return new HumanMessage({ //Ye text user ki taraf se aaya hai
                    id: message._id.toString(),
                    content: message.content || "",
                })
            }
            if (message.author === "ai") {
                return new AIMessage({
                    id: message._id.toString(),
                    content: message.content || "",
                    //Saved tool calls bhi yahan map hote hain.
                    tool_calls: message.toolCalls?.map(toolCall => {
                        return {
                            id: toolCall.id || "",
                            name: toolCall.name || "",
                            args: toolCall.arguments || {}
                        }
                    })
                })
            }


            return new ToolMessage({
                id: message._id.toString(), //database mein is message ka ID
                content: message.content || "", 
                tool_call_id: message.toolCallId || "", //AI ki us tool request ka ID, jiska ye jawab hai
                name: message.toolCalls?.[0]?.name || "",
            })

        });

    // State snapshots include the input history and all earlier outputs.
    // Seed their IDs so existing records are not inserted again.
    const savedMessageIds = new Set(history.map(message => message.id!));
    const stream = await handleUserMessage(history, project.projectId?.toString() || ""); //Ab prepared history main AI agent ko bhejte hain.

    for await (const [mode, data] of stream) {

        if (mode === "messages") {

            const [token] = data;

            res.write(`data: ${JSON.stringify({ text: token.text })}\n\n`);
        } else if (mode === "values") {
            // Persist every output, including parallel tool results, in order.
            for (const [index, newMessage] of data.messages.entries()) {
                // This agent appends to history; position is a fallback for ID-less outputs.
                const messageId = newMessage.id ?? `state-index:${index}`;
                if (savedMessageIds.has(messageId)) continue;

                if (AIMessage.isInstance(newMessage) || AIMessageChunk.isInstance(newMessage)) {
                    await MessageModel.create({
                        conversationId: conversation.id,
                        author: "ai",
                        content: newMessage.text,
                        toolCalls: newMessage.tool_calls?.map(toolCall => ({
                            id: toolCall.id || "",
                            name: toolCall.name || "",
                            arguments: toolCall.args || {},
                        })) || [],
                    });
                } else if (ToolMessage.isInstance(newMessage)) {
                    await MessageModel.create({
                        conversationId: conversation.id,
                        author: "tool",
                        content: typeof newMessage.content === "string"
                            ? newMessage.content
                            : JSON.stringify(newMessage.content),
                        toolCallId: newMessage.tool_call_id || "",
                    });
                } else {
                    continue;
                }

                // Only mark saved after the database write succeeds.
                savedMessageIds.add(messageId);
            }

        }
    }

    res.end();
}