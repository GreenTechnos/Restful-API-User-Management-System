export class Alert {
    id: string;
    type: string;
    message: string;
    autoClose: boolean;
    keepAfterRouteChange: boolean;
    fade: boolean;
    priority: number = 5; // Default priority, higher numbers = higher priority
    timeout: number = 3000;  // Default timeout in milliseconds

    constructor(init?: Partial<Alert>) {
        Object.assign(this, init);
    }
}

export enum AlertType {
    Success,
    Error,
    Info,
    Warning
}