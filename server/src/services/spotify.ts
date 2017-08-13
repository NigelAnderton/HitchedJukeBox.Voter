import * as logger from 'morgan';
import * as socketIo from "socket.io";
import * as SpotifyWebApi from 'spotify-web-api-node';

import { SpotifyRequest } from '../models/shared/spotify/spotify-request';
import { SpotifySearchRequest } from '../models/shared/spotify/spotify-search-request';
import { SpotifySearchResponse } from '../models/shared/spotify/spotify-search-response';
import { SpotifySearchResponseData } from '../models/shared/spotify/spotify-search-response-data';
import { SpotifyTrackRequest } from '../models/shared/spotify/spotify-track-request';
import { SpotifyTrackResponse } from '../models/shared/spotify/spotify-track-response';
import { SpotifyTrackResponseData } from '../models/shared/spotify/spotify-track-response-data';
import { SpotifyAlbumRequest } from '../models/shared/spotify/spotify-album-request';
import { SpotifyAlbumResponse } from '../models/shared/spotify/spotify-album-response';
import { SpotifyAlbumResponseData } from '../models/shared/spotify/spotify-album-response-data';

export class SpotifyService {
    public static readonly SERVICE_PREFIX: string = "Spotify";

    private appPrefix: string;

    private io: SocketIO.Server;
    private spotify: SpotifyWebApi;
    private timer: NodeJS.Timer;

    public static bootstrap(): SpotifyService {
        return new SpotifyService().bootstrap();
    }

    constructor() {
        this.config();
    }

    private bootstrap(): SpotifyService {
        this.setup_key();
        return this;
    }

    private config(): void {
        console.log('Spotify Service Initiated!');
        this.spotify = new SpotifyWebApi({
            clientId: '4658a83f5b35440398ea4f3590979658',
            clientSecret: 'f4c1782bf58446518647dd2c9a272bc2'
        });
    }

    public setup_key(): void {
        this.spotify.clientCredentialsGrant()
            .then((data) => {
                // Save the access token so that it's used in future calls
                this.spotify.setAccessToken(data.body['access_token']);
                let expiry: number = parseInt(data.body['expires_in']) - 10;

                clearTimeout(this.timer);
                this.timer = setTimeout(() => {
                    this.setup_key();
                }, expiry * 1000);

                console.log('The access token is ' + data.body['access_token']);

            }, (err) => {
                console.log('Something went wrong when retrieving an access token: ', err);
            });
    }

    public register_hooks(io: SocketIO.Server, socket: SocketIO.Socket, appPrefix: string): void {
        this.io = io;
        this.appPrefix = appPrefix;
        socket.on(
            SpotifyRequest.fetchCommandHook(appPrefix, SpotifyService.SERVICE_PREFIX),
            (spotifyRequest: SpotifyRequest): any => {
                spotifyRequest = SpotifyRequest.FromObject(spotifyRequest);
                switch (spotifyRequest.GetType()) {
                    case SpotifyRequest.SEARCH:
                        this.handle_search(spotifyRequest.GetValue());
                        break;
                    case SpotifyRequest.FETCH_TRACKS:
                        this.handle_track_request(spotifyRequest.GetValue());
                        break;
                    case SpotifyRequest.FETCH_ALBUMS:
                        this.handle_album_request(spotifyRequest.GetValue());
                        break;
                    default:
                }
            });
    }

    private handle_search(searchRequest: SpotifySearchRequest): void {
        searchRequest = SpotifySearchRequest.FromObject(searchRequest);

        let searchObject: any;
        switch (searchRequest.GetType()) {
            case SpotifySearchRequest.ST_ALBUM:
                searchObject = this.spotify.searchAlbums(searchRequest.GetSearchValue());
                break;
            case SpotifySearchRequest.ST_ARTIST:
                searchObject = this.spotify.searchArtists(searchRequest.GetSearchValue());
                break;
            case SpotifySearchRequest.ST_SONG:
            default:
                searchObject = this.spotify.searchTracks(searchRequest.GetSearchValue());
        }

        searchObject.then((data) => {
            let searchData: SpotifySearchResponseData = new SpotifySearchResponseData().loadFromData(data);
            this.io.emit(
                SpotifySearchResponse.fetchSearchResponseHook(this.appPrefix, SpotifyService.SERVICE_PREFIX),
                new SpotifySearchResponse(
                    searchRequest.GetType(),
                    searchData.GetItems(),
                    searchData.GetLimit(),
                    searchData.GetTotal(),
                    searchData.GetOffset()
                )
            );
        }, (err) => {
            if (err.statusCode == 401) {
                this.setup_key();
                this.handle_search(searchRequest);
            }
        });
    }

    private handle_track_request(trackRequest: SpotifyTrackRequest): void
    {
        trackRequest = SpotifyTrackRequest.FromObject(trackRequest);
        let searchObject: any = this.spotify.getAlbumTracks(trackRequest.GetAlbumID());

        searchObject.then((data) => {
            let trackData: SpotifyTrackResponseData = new SpotifyTrackResponseData().loadFromData(data);
            this.io.emit(
                SpotifyTrackResponse.fetchTrackResponseHook(this.appPrefix, SpotifyService.SERVICE_PREFIX),
                new SpotifyTrackResponse(
                    trackRequest.GetAlbumID(),
                    trackData.GetItems(),
                    trackData.GetLimit(),
                    trackData.GetTotal(),
                    trackData.GetOffset()
                )
            );
        }, (err) => {
            console.log(err);
        });
    }

    private handle_album_request(albumRequest: SpotifyAlbumRequest): void
    {
        albumRequest = SpotifyAlbumRequest.FromObject(albumRequest);
        let searchObject: any = this.spotify.getArtistAlbums(albumRequest.GetArtistID());

        searchObject.then((data) => {
            let albumData: SpotifyAlbumResponseData = new SpotifyAlbumResponseData().loadFromData(data);
            this.io.emit(
                SpotifyAlbumResponse.fetchAlbumResponseHook(this.appPrefix, SpotifyService.SERVICE_PREFIX),
                new SpotifyAlbumResponse(
                    albumRequest.GetArtistID(),
                    albumData.GetItems(),
                    albumData.GetLimit(),
                    albumData.GetTotal(),
                    albumData.GetOffset()
                )
            );
        }, (err) => {
            console.log(err);
        });
    }
}