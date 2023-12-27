import Pusher from "pusher-js";

export const pusherInstance = () => {
    // Pusher.logToConsole = true;
    return (new Pusher(import.meta.env.VITE_APIkey, {
        cluster: 'ap2'
    }));
}