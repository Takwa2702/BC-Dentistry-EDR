CREATE TABLE IF NOT EXISTS Push_Subscription (
    Push_Subscription_ID BIGINT NOT NULL AUTO_INCREMENT,
    Recipient_Role VARCHAR(32) NOT NULL,
    Recipient_ID VARCHAR(255) NOT NULL,
    Platform ENUM('web', 'android', 'ios') NOT NULL,
    Push_Token VARCHAR(512) NOT NULL,
    Device_Label VARCHAR(255) NULL,
    Active BOOLEAN NOT NULL DEFAULT TRUE,
    Created_At TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    Updated_At TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    Last_Error VARCHAR(500) NULL,
    PRIMARY KEY (Push_Subscription_ID),
    UNIQUE KEY uq_push_token (Push_Token),
    KEY idx_push_recipient (Recipient_Role, Recipient_ID, Active)
);
