import Alarm from "../images/icons/notifications.png"
import UserType from "./UserType";
import { useEffect, useState } from "react";
import { authHeaders, blockchainUrl, jsonHeaders } from "../config/api";

const Notifications = () => {
    const [notifications, setNotifications] = useState([]);
    const unread = notifications.filter((notification) => notification.status === "UNREAD").length;

    useEffect(() => {
        const loadNotifications = async () => {
            try {
                const response = await fetch(blockchainUrl("/notifications?status=ALL"), {
                    headers: authHeaders(),
                });
                const payload = await response.json();
                if (response.ok) {
                    setNotifications(payload.data || payload || []);
                }
            } catch (error) {
                console.warn("Unable to load notifications", error);
            }
        };
        loadNotifications();
    }, []);

    const markLatestRead = async () => {
        const notification = notifications.find((item) => item.status === "UNREAD");
        if (!notification) return;
        try {
            const response = await fetch(blockchainUrl(`/notifications/${encodeURIComponent(notification.notificationID)}/read`), {
                method: "POST",
                headers: jsonHeaders(),
            });
            const payload = await response.json();
            if (response.ok) {
                setNotifications((items) => items.map((item) => item.notificationID === notification.notificationID ? (payload.data || payload) : item));
            }
        } catch (error) {
            console.warn("Unable to mark notification read", error);
        }
    };

    return (
        <div className="flex items-center gap-x-8">
            {/* <UserType type={"Doctor"} /> */}
            <UserType />
            <button id="Notifications" type="button" aria-label={`${unread} unread notifications. Mark latest as read`} disabled={!unread} className="relative flex h-10 w-10 cursor-pointer p-2 disabled:cursor-default disabled:opacity-60" onClick={markLatestRead} title={notifications[0]?.message || "Notifications"}>
                <img src={Alarm} alt="" aria-hidden="true" />
                {unread > 0 && <span aria-hidden="true" className="absolute -right-1 -top-1 rounded-full bg-red-600 px-1.5 text-xs text-white">{unread}</span>}
                <span className="sr-only" aria-live="polite">{unread} unread notifications</span>
            </button>

        </div>
    )
}

export default Notifications;
