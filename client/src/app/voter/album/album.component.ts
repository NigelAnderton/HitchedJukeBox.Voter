import { Component, OnInit, Input } from '@angular/core';
import { ISubscription } from "rxjs/Subscription";

import { SpotifyService } from '../../core/spotify/spotify.service';

import { SpotifyAlbum } from '../../core/models/shared/core/spotify-album'

import { SpotifyRequest } from '../../core/models/shared/spotify/spotify-request';
import { SpotifyTrackRequest } from '../../core/models/shared/spotify/spotify-track-request';
import { SpotifyTrackResponse } from '../../core/models/shared/spotify/spotify-track-response';

@Component({
    selector: 'app-album',
    templateUrl: './album.component.html',
    styleUrls: ['../../about/about.component.scss']
})
export class AlbumComponent implements OnInit {

    @Input()
    album: SpotifyAlbum;
    private connection: ISubscription;
    private amFetchingTracks: boolean = false;

    constructor(private spotifyService: SpotifyService) { }

    ngOnInit() {
        this.album = new SpotifyAlbum(this.album);
        let responseHook: string = SpotifyTrackResponse.fetchTrackResponseHook(SpotifyService.appPrefix, SpotifyService.servicePrefix);
        this.connection = this.spotifyService.listen(responseHook).subscribe(trackResult => {
            let trackResponse = SpotifyTrackResponse.FromObject(trackResult);
            if (trackResponse.GetID() == this.album.GetID()) {
                this.amFetchingTracks = false;
                this.album.tracks = trackResponse.GetItems();
            }
        });
    }

    fetchTracks() {
        this.amFetchingTracks = true;
        let tracksRequest = new SpotifyTrackRequest(this.album.GetID());
        let spotifyRequest = new SpotifyRequest(SpotifyRequest.FETCH_TRACKS, tracksRequest);
        this.spotifyService.talk(spotifyRequest);
    }

}