import React, { Component } from 'react';
import {
    Map, Marker, Popup, TileLayer,
} from 'react-leaflet';
import L from 'leaflet';
import 'leaflet-gpx';
import './map.scss';
import PropTypes from 'prop-types';
import {
    Button,
    Grid
} from '@material-ui/core';
import {
    EventAvailable,
    EventBusy,
} from '@material-ui/icons';
import { deletePoi, toggleAvailability, toggleLike, fileToData } from '../../shared/api.service';
import FormDialog from '../manage-poi/poi-modal/poi-modal';
import Gallery from '../gallery/gallery';
import ReactLeafletSearch from "react-leaflet-search";
import ThumbUpIcon from '@material-ui/icons/ThumbUp';

// Correction of the invisble icon
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: require('leaflet/dist/images/marker-icon-2x.png'),
    iconUrl: require('leaflet/dist/images/marker-icon.png'),
    shadowUrl: require('leaflet/dist/images/marker-shadow.png'),
});

const DEFAULT_LATITUDE = 46.292894;
const DEFAULT_LONGITUDE = 7.536433;
const DEFAULT_ZOOM = 10;
const TIMER = 1500;

class LeafletMapComponent extends Component {
    constructor(props) {
        super(props);
        this.state = {
            lat: DEFAULT_LATITUDE,
            lng: DEFAULT_LONGITUDE,
            zoom: DEFAULT_ZOOM,
            pois: props.pois,
            userId: props.userId || undefined,
            minPrice: props.minPrice,
            maxPrice: props.maxPrice,
            loginWithRedirect: props.loginWithRedirect,
            getTokenSilently: props.getTokenSilently,
            updatePoiList: props.updatePoiList,
            updateCategoryList: props.updateCategoryList,
            clickedPosition: undefined,
        };
        this.mapRef = null;
        this.showDeleteButton = this.showDeleteButton.bind(this);
        this.showToggleAvailabilityButton = this.showToggleAvailabilityButton.bind(this);
        this.handleDeletePoi = this.handleDeletePoi.bind(this);
        this.handleToggleAvailability = this.handleToggleAvailability.bind(this);
        this.handleClickPress = this.handleClickPress.bind(this);
        this.handleClickRelease = this.handleClickRelease.bind(this);
        this.handleLike = this.handleLike.bind(this);
    }

    getCurrentLocation() {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                position => {
                    this.setState({
                        lat: position.coords.latitude,
                        lng: position.coords.longitude
                    });
                }
            )
        } else {
            console.log("Cannot get location");
        }
    }

    componentDidMount() {
        this.getCurrentLocation(); //get the location trough the web browser
    }

    componentDidUpdate(prevProps) {
        if (this.props.pois !== prevProps.pois) {
            this.setState({ pois: this.props.pois });
        }
        if (this.props.minPrice !== prevProps.minPrice) {
            this.setState({ minPrice: this.props.minPrice });
        }
        if (this.props.maxPrice !== prevProps.maxPrice) {
            this.setState({ maxPrice: this.props.maxPrice });
        }
    }

    showDeleteButton(creator, user, poiKey) {
        if (creator === user) {
            return (
                <Button
                    className="buttonPopup"
                    variant="contained"
                    color="secondary"
                    key={poiKey}
                    onClick={async () => this.handleDeletePoi(poiKey)}
                >
                    Delete
                </Button>
            );
        }
    }

    showToggleAvailabilityButton(creator, user, poi) {
        if (creator === user) {
            return (
                <Button
                    className="buttonPopup"
                    variant="contained"
                    color={poi.status.name === 'status_available' ? 'secondary' : 'primary'}
                    key={poi.key}
                    onClick={async () => this.handleToggleAvailability(poi.status.name === 'status_available', poi.key)}
                >
                    Set as {poi.status.name === 'status_available' ? 'busy' : 'free'}
                </Button>
            );
        }
    }

    async handleDeletePoi(poiKey) {
        if (!window.confirm('Do you really want to delete this?'))
            return;

        await deletePoi(poiKey, this.state.getTokenSilently, this.state.loginWithRedirect);
        await this.state.updatePoiList();
    }

    async handleToggleAvailability(currentlyAvailable, poiKey) {
        await toggleAvailability(currentlyAvailable, poiKey, this.state.getTokenSilently, this.state.loginWithRedirect);
        await this.state.updatePoiList();
    }

    handleClickPress(e) {
        const { lat, lng } = e.latlng;
        this.buttonPressTimer = setTimeout(() => this.setState({ clickedPosition: { lat, lng } }), TIMER);

    }
    handleClickRelease() {
        clearTimeout(this.buttonPressTimer);
    }

    async handleLike(poi) {
        await toggleLike(poi, this.state.getTokenSilently, this.state.loginWithRedirect);
        this.state.updatePoiList();
    }    
    
    getColorPercentage(price) {
        const green = 120;
        const res = 0;
        const percent = (price - this.state.minPrice) * 100 / (this.state.maxPrice - this.state.minPrice);

        const a = percent / 100,
            b = (res - green) * a,
            c = b + green;

        return `hsl(${c}, 100%, 50%)`;
    }

    async handleGpx(poi) {
        if (poi.file !== null && this.mapRef !== null) {
            // get the proper path
            let filePath = poi.file.path.split('/');
            filePath = filePath[filePath.length - 1];
            const file = await fileToData(filePath,  this.state.getTokenSilently, this.state.loginWithRedirect);
            const map = this.mapRef.leafletElement;
            new L.GPX(file.data, {async: true}).on('loaded', function(e) {
                map.fitBounds(e.target.getBounds());
              }).addTo(map);
        }
    }

    render() {
        const position = [this.state.lat, this.state.lng]
        return (
            <div className="map-wrapper">
                <Map
                    ref={mapRef => { this.mapRef = mapRef } }
                    center={position}
                    zoom={this.state.zoom}
                    onTouchStart={this.handleClickPress}
                    onTouchEnd={this.handleClickRelease}
                    onMouseDown={this.handleClickPress}
                    onMouseUp={this.handleClickRelease}
                    onMove={this.handleClickRelease}
                    onMouseLeave={this.handleClickRelease}>
                    <TileLayer
                        attribution='&amp;copy <a href="http://osm.org/copyright">OpenStreetMap</a> contributors'
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />
                    <ReactLeafletSearch
                        className="leaflet-search"
                        position="topright"
                        inputPlaceholder="Search for a location..."
                        zoom={this.state.DEFAULT_ZOOM}
                        showPopup={false}
                        showMarker={false}
                        openSearchOnLoad={true}
                        closeResultsOnClick={true}
                    />
                    {this.state.pois.map((poi) => (
                        <Marker
                            onClick={() => this.handleGpx(poi)}
                            key={poi.key}
                            position={poi.position}
                            name={poi.name}
                            description={poi.description}
                            icon={L.divIcon({
                                className: "custom-marker-pin",
                                iconAnchor: [0, 24],
                                labelAnchor: [-6, 0],
                                popupAnchor: [0, -36],
                                html: `<span class="custom-pin" style="background-color:${this.getColorPercentage(poi.price)}">${poi.price.toLocaleString()}<br/>CHF</span>`
                            })}
                        >
                            <Popup className="request-popup">
                                <h1>
                                    {poi.name}
                                </h1>
                                <p className="homeType">
                                    {poi.homeType}
                                </p>
                                <Grid container spacing={0} className="price-container" style={{ textAlign: 'center' }}>
                                    <Grid item xs={6}>
                                        {poi.price.toLocaleString()} CHF
                                    </Grid>
                                    <Grid item xs={6}>
                                        {poi.shareType}
                                    </Grid>
                                </Grid>
                                <p>
                                    {poi.description}
                                </p>
                                <div className="availability">
                                    {poi.status.name === 'status_available' ?
                                        <div className="available">
                                            <EventAvailable /> Place is available right now
                                    </div> :
                                        <div className="busy">
                                            <EventBusy /> Place is busy at the moment
                                    </div>}
                                </div>
                                {poi.image !== null && poi.image !== '' &&
                                    <Gallery
                                        fileIds={poi.image ? poi.image.split(';') : []}
                                        loginWithRedirect={this.state.loginWithRedirect}
                                        getTokenSilently={this.state.getTokenSilently}
                                    ></Gallery>
                                }
                                <Grid container spacing={1} className="gridContainer2">
                                    <Grid item xs={6}>
                                        {this.showToggleAvailabilityButton(poi.creatorId, this.state.userId, poi)}
                                    </Grid>
                                    <Grid item xs={6}>
                                        {this.showDeleteButton(poi.creatorId, this.state.userId, poi.key)}
                                    </Grid>
                                    <Grid item xs={12}>
                                        <h4>Likes : {poi.likes}
                                            <ThumbUpIcon onClick={() => this.handleLike(poi)} style={{ float: 'right', cursor: 'pointer', color: poi.liked ? 'blue' : 'grey' }}></ThumbUpIcon>
                                        </h4>
                                    </Grid>
                                </Grid>
                            </Popup>
                        </Marker>
                    ))
                    }
                </Map>
                <FormDialog
                    updatePoiList={this.state.updatePoiList}
                    updateCategoryList={this.state.updateCategoryList}
                    position={this.state.clickedPosition}
                />
            </div>
        )
    }
}

LeafletMapComponent.propTypes = {
    pois: PropTypes.array.isRequired,
    userId: PropTypes.string,
    loginWithRedirect: PropTypes.func.isRequired,
    getTokenSilently: PropTypes.func.isRequired,
    updatePoiList: PropTypes.func.isRequired,
    updateCategoryList: PropTypes.func.isRequired,
    minPrice: PropTypes.number.isRequired,
    maxPrice: PropTypes.number.isRequired,
}

export default LeafletMapComponent;
