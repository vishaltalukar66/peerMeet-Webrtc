// const confi = {
//     iceServers: [
//         {
//             urls: [
//                 'stun:stun1.l.google.com:19302',
//                 'stun:stun3.l.google.com:19302',

//             ],
//         },
//     ],
//     iceCandidatePoolSize: 10
// }
// export const pc = new RTCPeerConnection(confi);


const configuration = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
    ],
};
export const pc = new RTCPeerConnection(configuration);
