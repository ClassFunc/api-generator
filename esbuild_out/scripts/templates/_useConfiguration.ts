import {useEffect, useState} from "react";
// @ts-ignore
import {Configuration, ConfigurationParameters} from "../";
import {getAuth} from 'firebase/auth'
import {get} from "lodash";

// Định nghĩa các loại môi trường có thể có để code được tường minh hơn
export type ExecutionEnvironment = 'WebApp' | 'ChromeExtension';

/**
 * Kiểm tra và trả về môi trường mà code đang được thực thi.
 * @returns {'WebApp' | 'ChromeExtension'} - Trả về 'ChromeExtension' nếu chạy trong tiện ích, ngược lại trả về 'WebApp'.
 */
export function getExecutionEnvironment(): ExecutionEnvironment {
    // Kiểm tra xem đối tượng `chrome` và thuộc tính `chrome.runtime` có tồn tại không.
    // `chrome.runtime.id` là một thuộc tính luôn có trong môi trường extension sau khi được cài đặt.
    // Việc kiểm tra `window.chrome` đảm bảo code không bị lỗi "ReferenceError" khi chạy trên môi trường web.
    if (
        get(window, 'chrome.runtime.id')
    ) {
        return 'ChromeExtension';
    } else {
        return 'WebApp';
    }
}

export const useConfiguration = (configParams?: ConfigurationParameters) => {
    const [conf, setConf] = useState<Configuration>();
    useEffect(() => {
        // accessTokenBuilder
        const accessTokenBuilder = async (): Promise<string> => {
            // CHROME EXTENSION APP
            // @ts-ignore
            if (getExecutionEnvironment() === 'ChromeExtension') {
                // Running inside a Chrome App context
                return new Promise<string>((resolve) => {
                    /*
                    example code for dev:
                    // token get listener
                    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
                        if (message.type === 'GET_ID_TOKEN') {
                            (async () => {
                                const currentUser = auth.currentUser;
                                if (currentUser) {
                                    try {
                                        const idToken = await currentUser.getIdToken(true);
                                        sendResponse({success: true, token: idToken});
                                    } catch (error) {
                                        console.error("Error getting ID token:", error);
                                        sendResponse({success: false, error: (error as Error).message});
                                    }
                                } else {
                                    // Trường hợp người dùng đã đăng xuất hoặc có lỗi
                                    sendResponse({success: false, error: "User not authenticated."});
                                }
                            })();

                            return true; // Quan trọng: báo hiệu rằng sendResponse sẽ được gọi bất đồng bộ
                        }
                    });
                    * */
                    // Send request to runtime to get a token
                    // @ts-ignore
                    window.chrome.runtime.sendMessage({type: 'GET_ID_TOKEN'}, (response: any) => {
                        if (response && response.success) {
                            // Nếu thành công, trả về token
                            resolve(response.token);
                        } else {
                            // Nếu thất bại, log lỗi và trả về chuỗi rỗng
                            console.error("Could not get auth token from background:", response?.error);
                            resolve('');
                        }
                    });
                })
            } else {
                // NORMAL WEB APP (REACT, NEXT.JS,...)
                // Not a Chrome app or not running as an app window
                return (await getAuth().currentUser?.getIdToken()) || '';
            }
        }
        // conf
        const conf = new Configuration(
            {
                accessToken: () => accessTokenBuilder() || '',
                ...{
                    basePath: process.env.NEXT_PUBLIC_DEV_API_BASE_URL
                        ? process.env.NEXT_PUBLIC_DEV_API_BASE_URL
                        : undefined,
                },
                ...configParams,
            },
        );
        setConf(conf);
    }, []);

    return conf;
};