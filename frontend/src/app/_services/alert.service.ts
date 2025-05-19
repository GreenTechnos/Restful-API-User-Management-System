import { Injectable } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import { filter } from 'rxjs/operators';

import { Alert, AlertType } from '@app/_models';

@Injectable({ providedIn: 'root' })
export class AlertService {
    private subject = new Subject<Alert>();
    private defaultId = 'default-alert';

    // enable subscribing to alerts observable
    onAlert(id = this.defaultId): Observable<Alert> {
        return this.subject.asObservable().pipe(filter(x => x && x.id === id));
    }

    // convenience methods
    success(message: string, options?: any) {
        this.alert(new Alert({ 
            ...options, 
            type: AlertType.Success, 
            message,
            priority: options?.priority || 10, // Higher default priority for success messages
            autoClose: options?.autoClose !== undefined ? options.autoClose : true 
        }));
    }

    error(message: string, options?: any) {
        this.alert(new Alert({ 
            ...options, 
            type: AlertType.Error, 
            message,
            priority: options?.priority || 10,
            autoClose: options?.autoClose !== undefined ? options.autoClose : true 
        }));
    }

    info(message: string, options?: any) {
        this.alert(new Alert({ 
            ...options, 
            type: AlertType.Info, 
            message,
            priority: options?.priority || 5,
            autoClose: options?.autoClose !== undefined ? options.autoClose : true,
            timeout: options?.timeout || 3000  // Default 3 seconds, but can be customized
        }));
    }

    warn(message: string, options?: any) {
        this.alert(new Alert({ 
            ...options, 
            type: AlertType.Warning, 
            message,
            priority: options?.priority || 7,
            autoClose: options?.autoClose !== undefined ? options.autoClose : true 
        }));
    }

    // core alert method
    alert(alert: Alert) {
        alert.id = alert.id || this.defaultId;
        alert.autoClose = (alert.autoClose === undefined ? true : alert.autoClose);
        this.subject.next(alert);
    }

    // clear alerts
    clear(id = this.defaultId) {
        this.subject.next(new Alert({ id }));
    }
}