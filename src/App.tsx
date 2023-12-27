
import Pusher from 'pusher-js';
import { useCallback, useEffect, useState } from 'react'
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { pusherInstance } from './utils/pusherInstance';
import { pc } from './utils/pcOneRTC';
import ReactPlayer from 'react-player';

function App() {
  // State variables for authentication, peer information, chat status, and streams
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [peerUsername, setPeerUsername] = useState<string>('');
  const [isChatActive, setIsChatActive] = useState(false);
  const [localMediaStream, setLocalMediaStream] = useState<MediaStream | null>(null);
  const [remoteMediaStream, setRemoteMediaStream] = useState<MediaStream | null>(null);

  // State variables for user details (username and room ID)
  const [username, setUsername] = useState<string>('');
  const [room, setRoom] = useState<string>('');

  // Function to send messages to establish WebRTC connections
  const sendMessage = useCallback(async (type: string, data: string, to: string) => {
    try {
      const response = await fetch(`http://127.0.0.1:8080/webrtc/connect`, {
        method: 'POST',
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ room: room, to: to, from: username, data: data, type: type })
      })
        // Parse the response and handle success/failure
        .then((res) => res.json())
        .then((jsonData) => {
          return jsonData;
        }) as { status: number, message: string };

      if (response.status === 200) {
        toast.success(`${response.message}`);
      } else {
        toast.warn(`${response.message}`);
      }
    } catch (error) {
      toast.warn('Error in establishing connection:');
    }
  }, [room, username]);

  // Function to handle joining a call
  const handleJoinCall = async () => {
    const offer = await pc.createOffer();
    await pc.setLocalDescription(new RTCSessionDescription(offer));

    // send offer to peer
    await sendMessage('offer', JSON.stringify(offer), peerUsername);
  }

  // Function to handle receiving an offer from a peer
  const handleOffer = async (offer: string, from: string) => {
    await pc.setRemoteDescription(JSON.parse(offer));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(new RTCSessionDescription(answer));

    // send answer to peer
    await sendMessage('answer', JSON.stringify(answer), from);
    setPeerUsername(from);
  }

  // Function to enable video stream
  const turnOnVideo = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: true,
    });

    setLocalMediaStream(stream);
  }

  // Function to handle receiving an answer from a peer
  const handleAnswer = async (answer: string) => {
    await pc.setRemoteDescription(new RTCSessionDescription(JSON.parse(answer)));
    console.log("CALL ACCEPTED \n");
    sendMessage('success', "Call Accepted", 'all');
  }

  // Function to subscribe to new user channels
  const subscribeToNewUserChannel = async () => {
    const channel = pusherInstance().subscribe(`chat-${room}`);
    channel.bind("user-joined", async (data: { room: string, newUsername: string }) => {
      toast(`${data.newUsername} joined the room ${data.room}`);
      setPeerUsername(data.newUsername);
    });

    const channelPeer = pusherInstance().subscribe("web");
    channelPeer.bind("message", async (data: { from: string, to: string, data: string, type: string, room: string }) => {
      console.log(data);
      console.log("\n\n New line")
      switch (data.type) {
        case 'offer':
          (data.from === username) ? (console.log('Ignore offer')) : (
            console.log("\n\n Got Offer"),
            await handleOffer(data.data, data.from)
          );
          break;
        case 'answer':
          (data.from === username) ? (console.log('Ignore answer')) : (
            await handleAnswer(data.data)
          );
          break;
        case 'success':
          setIsChatActive(!isChatActive);
          turnOnVideo();
          break;
        default:
          break;
      }
    })
  }


  // Function to handle joining a room
  const handleJoinRoom = async (e: React.SyntheticEvent) => {
    e.preventDefault();
    try {
      const response = await fetch(`http://127.0.0.1:8080/common/createroom`, {
        method: 'POST',
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ room: room, newUsername: username })
      })
        .then((res) => res.json())
        .then((jsonData) => {
          return jsonData;
        }) as { status: number, message: string };

      if (response.status === 200) {
        setIsAuthenticated(!isAuthenticated);
        subscribeToNewUserChannel();
        toast.success(`Joined room ${room}`);
      } else {
        toast.warn(`${response.message}`);
      }
    } catch (error) {
      toast.warn('Error joining room:');
    }
  }

  // Function to handle negotiation
  const handleNego = useCallback(async () => {

    const offer = await pc.createOffer();
    await pc.setLocalDescription(new RTCSessionDescription(offer));
    await sendMessage('offer', JSON.stringify(offer), peerUsername);
  }, [peerUsername, sendMessage]);

  // Function to send video streams
  const sendStreams = useCallback(() => {
    if (localMediaStream) {
      for (const track of localMediaStream.getTracks()) {
        console.log("into frames");
        pc.addTrack(track, localMediaStream);
        console.log("sent stream");
      }
      toast.success(`Sent streams to ${peerUsername}`)
    }
  }, [localMediaStream, peerUsername]);

  // Function to handle remote streams
  const handleRemoteStream = useCallback((ev: RTCTrackEvent) => {
    console.log("into Remote Tracks");
    const remoteStream = ev.streams;
    console.log("GOT TRACKS!!");
    setRemoteMediaStream(remoteStream[0]);
  }, []);

  // Effect to set up event listeners for remote tracks
  useEffect(() => {
    pc.addEventListener("track", handleRemoteStream);
  }, [handleRemoteStream]);

  // Effect to set up event listeners
  useEffect(() => {
    pc.onicecandidate = e => {
      console.log('New ICE ', pc.localDescription);
    }

    pc.addEventListener("negotiationneeded", handleNego);

    return () => {
      pc.removeEventListener("negotiationneeded", handleNego);
    }
  }, [handleNego]);

  // Effect to clean up Pusher subscriptions when the component unmounts
  useEffect(() => {
    Pusher.logToConsole = false; // Disable Pusher logging to console
    const pusher = new Pusher(import.meta.env.VITE_APIkey, {
      cluster: 'ap2'
    });

    pusher.unsubscribe(`chat-${room}`);
    pusher.unsubscribe(`web`);
  }, [room]);

  return (
    <>
      <ToastContainer />

      {isAuthenticated ? (
        <>
          <div className="flex flex-col text-center items-center justify-center h-screen bg-gray-100">
            {isChatActive ? (
              <>
                <div className="lg:flex m-6 lg:space-x-4">
                  {localMediaStream && (
                    <div className="lg:w-1/2">
                      <h1 className="text-lg font-bold mb-4">My Stream</h1>
                      <ReactPlayer
                        playing
                        muted
                        height="md:h-64 lg:h-32" // Responsive height using Tailwind CSS classes
                        width="full"
                        url={localMediaStream}
                        className="mb-4"
                      />

                    </div>
                  )}
                  {remoteMediaStream && (
                    <div className="lg:w-1/2 ">
                      <h1 className="text-lg font-bold mt-4 lg:mt-0">Remote Stream</h1>
                      <ReactPlayer
                        playing
                        height="md:h-64 lg:h-32" // Responsive height using Tailwind CSS classes
                        width="full"
                        url={remoteMediaStream}
                        className="mt-2"
                      />
                    </div>
                  )}
                </div>
                <button
                  onClick={sendStreams}
                  className="py-2 px-4 text-lg font-semibold bg-cyan-600 rounded mt-4"
                >
                  Send Stream to {peerUsername}
                </button>
              </>
            ) : (
              <>
                {peerUsername ? (
                  <button
                    onClick={handleJoinCall}
                    className="py-2 px-4 text-lg font-semibold bg-cyan-600/40 rounded"
                  >
                    Start Call
                  </button>
                ) : (
                  <p className="mt-4">Waiting for the other user to join/start the call.</p>
                )}
              </>
            )}
          </div>



        </>
      ) : (
        <>
          {/* Info */}
          <div className="container w-3/4 mx-auto p-4 grid grid-cols-1 md:grid-cols-2 gap-4 ">
            <div className=" p-4 rounded-xl bg-gray-300/50 ">
              <div className="text-xl  font-semibold md:text-5xl">
                ⭐️Welcome to the Peer-Meet.
              </div>
              <div className="mt-1 md:mt-4 text-justify">Peer-Meet, your go-to platform for seamless peer-to-peer meetings. Enter a unique Room ID, and connect instantly with your peers. Collaborate, discuss, and engage in real-time video interactions.</div>
            </div>
            <div className=" p-4 rounded-xl bg-gray-300/50 ">
              <div className="text-xl  font-semibold md:text-5xl">
                How it Works:
              </div>
              <div className="mt-1 md:mt-4 text-justify ">
                <ol className="list-decimal list-inside space-y-3">
                  <li className="font-semibold">Enter Your Details:
                    <ul className="font-normal list-disc list-inside ">
                      <li className="">Choose a unique username.</li>
                      <li>Enter a room ID for your peer-to-peer meeting.</li>
                    </ul>
                  </li>
                  <li className="font-semibold">Share Room ID:
                    <ul className="font-normal list-disc list-inside">
                      <li>Share the Room ID with your friend.</li>
                    </ul>
                  </li>
                  <li className="font-semibold">Start meeting:
                    <ul className="font-normal list-disc list-inside ">
                      <li>Once your friend joins with the Room ID, your peer-to-peer meeting begins.</li>
                    </ul>
                  </li>
                </ol>
              </div>
            </div>
          </div>

          {/* Login */}
          <div className="container mx-auto p-4 flex-nowrap justify-center text-center gap-4 text-lg">
            <div className="text-2xl">
              Enter Username and a Room ID
            </div>
            <form onSubmit={handleJoinRoom}>
              <div className="p-4  rounded ">
                <input value={username} required type="text" name="username" id="username" placeholder="Enter Username" className="p-1 w-56 border focus:outline-none focus:ring focus:ring-cyan-300  focus:bg-cyan-50/10 border-gray-300 pl-2" onChange={(e) => { setUsername(e.target.value) }} />
              </div>
              <div className="p-4  rounded ">
                <input required type="number" name="roomid" id="roomid" placeholder="Enter Room Id" className="w-56 border focus:outline-none focus:ring focus:ring-cyan-300  focus:bg-cyan-50/10 border-gray-300 pl-2" onChange={(e) => { setRoom(e.target.value) }} value={room} />



              </div>
              <div className="p-4  rounded ">
                <button className="w-20 text-lg font-semibold p-1 border focus:outline-none focus:ring focus:ring-cyan-300 bg-cyan-600/40 hover:bg-cyan-600 border-gray-300">Join</button>

              </div>
            </form>
          </div>

        </>)
      }


    </>
  )
}


export default App;
