import ZegoUIKitPrebuiltCallService from '@zegocloud/zego-uikit-prebuilt-call-rn';
import * as ZIM from 'zego-zim-react-native';
import * as ZPNs from 'zego-zpns-react-native';

// IMPORTANT: Replace these placeholders with your actual ZegoCloud AppID and AppSign!
export const ZEGO_APP_ID = 354168558; // Must be a number
export const ZEGO_APP_SIGN = "494094997c57a9468915449953e01e4f4fddcacb62f3d9f54fe8bf5761438fdc"; // Must be a string

export const initZegoService = async (userId, userName) => {
  try {
    if (ZEGO_APP_ID === 123456789) {
      console.warn("ZegoCloud: Using placeholder APP_ID. Calls will fail until updated.");
    }
    
    ZegoUIKitPrebuiltCallService.init(
      ZEGO_APP_ID,
      ZEGO_APP_SIGN,
      String(userId), // Firebase UID
      String(userName), // User's name
      [ZIM, ZPNs], // Plugins for background offline calls
      {
        ringtoneConfig: {
          incomingCallFileName: 'zego_incoming.mp3',
          outgoingCallFileName: 'zego_outgoing.mp3',
        },
        androidNotificationConfig: {
          channelID: "RobotInnCall",
          channelName: "RobotInnCall",
        },
      }
    );
    console.log("ZegoService initialized successfully for:", userId);
  } catch (error) {
    console.error("ZegoService initialization failed:", error);
  }
};

export const uninitZegoService = () => {
  ZegoUIKitPrebuiltCallService.uninit();
};
