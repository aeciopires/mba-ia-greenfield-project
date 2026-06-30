import { handlers as authHandlers } from "./auth";
import { handlers as channelHandlers } from "./channels";
import { handlers as seedHandlers } from "./_seed";

export const handlers = [...authHandlers, ...channelHandlers, ...seedHandlers];
