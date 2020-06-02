import { Injectable } from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {environment} from '../../environments/environment';
import {BehaviorSubject, from} from 'rxjs';
import {User} from './user.model';
import {map, tap} from 'rxjs/operators';
import { Plugins } from '@capacitor/core';

export interface AuthResponseData {
  kind:	string;
  idToken: string;
  email: string;
  refreshToken: string;
  localId: string;
  expiresIn: string;
  registered?: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  // tslint:disable-next-line:variable-name
  private _user = new BehaviorSubject<User>(null);

  get userIsAuthenticated() {
    return this._user.asObservable().pipe(
        map(user => {
          if (user) {
            return !!user.token;
          } else {
            return false;
          }
        })
    );
  }

  get userId() {
    return this._user.asObservable().pipe(
        map(user => {
          if (user) {
            return user.id;
          } else {
            return null;
          }
        })
    );
  }

  constructor(
      private http: HttpClient
  ) {}

  autoLogin() {
      return from(Plugins.Storage.get({ key: 'authData' })).pipe(
          map(storedData => {
              if (!storedData || !storedData.value) {
                  return null;
              }
              const parsedData = JSON.parse(storedData.value) as {
                  token: string;
                  tokenExpirationDate: string;
                  userId: string;
                  email: string;
              };
              const expirationTime = new Date(parsedData.tokenExpirationDate);
              if (expirationTime <= new Date()) {
                  return null;
              }
              const user = new User(
                  parsedData.userId,
                  parsedData.email,
                  parsedData.token,
                  expirationTime
              );
              return user;
          }),
          tap(user => {
              if (user) {
                  this._user.next(user);
              }
          }),
          map(user => {
              return !!user;
          })
      );
  }

  signup(email: string, password: string) {
    return this.http.post<AuthResponseData>(
        `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${
            environment.firebaseAPIKey
        }`,
        {email, password, returnSecureToken: true}
        ).pipe(tap(this.setUserData.bind(this)));
  }

  login(email: string, password: string) {
    return this.http.post<AuthResponseData>(
        `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${
            environment.firebaseAPIKey
        }`,
        { email, password, returnSecureToken: true }
        ).pipe(tap(this.setUserData.bind(this)));
  }

  logout() {
    this._user.next(null);
  }

  private setUserData(userData: AuthResponseData) {
      const expirationTime = new Date(
          new Date().getTime() + +userData.expiresIn * 1000
      );
      this._user.next(
          new User(
              userData.localId,
              userData.email,
              userData.idToken,
              expirationTime
          )
      );
      this.storeAuthData(
          userData.localId,
          userData.idToken,
          expirationTime.toISOString(),
          userData.email
      );
  }

  private storeAuthData(userId: string, token: string, tokenExpirationDate: string, email: string) {
      const data = JSON.stringify({
          userId,
          token,
          tokenExpirationDate,
          email
      });
      Plugins.Storage.set({ key: 'authData', value: data });
  }
}
