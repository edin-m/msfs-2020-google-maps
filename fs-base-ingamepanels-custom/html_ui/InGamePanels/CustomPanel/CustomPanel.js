var MapPanelLoaded = false;
var GoogleMapMarker = null;
var GoogleMap = null;
var MapPanel = null;
var myflightplan = null;

document.addEventListener('beforeunload', function () {
    MapPanelLoaded = false;
	console.log('beforeunload');
	
	MapPanel._intervals.forEach(interval => clearInterval(interval));
	
	GoogleMap = null;
}, false);


function eventFire(el, etype){
  if (el.fireEvent) {
    el.fireEvent('on' + etype);
  } else {
    var evObj = document.createEvent('Events');
    evObj.initEvent(etype, true, false);
    el.dispatchEvent(evObj);
  }
}

class IngamePanelMaps extends HTMLElement {
    constructor() {
        super();
		MapPanel = this;
		
		this._intervals = [];
    }
	
	initialize() {

	}
	
    isDebugEnabled() {
        /*var self = this;
        if (typeof g_modDebugMgr != "undefined") {
            g_modDebugMgr.AddConsole(null);
            g_modDebugMgr.AddDebugButton("ButtonCustomID1", function() {
                console.log('ButtonCustomID1');
                console.log(self.instrumentIdentifier);
            });
            g_modDebugMgr.AddDebugButton("ButtonCustomTemplateID1", function() {
                console.log('ButtonCustomTemplateID1');
                console.log(self.templateID);
            });
            g_modDebugMgr.AddDebugButton("ButtonCustomSource1", function() {
                console.log('ButtonCustomSource1');
                console.log(window.document.documentElement.outerHTML);
            });
        } else {
            Include.addScript("/JS/debug.js", function () {
                if (typeof g_modDebugMgr != "undefined") {
                    g_modDebugMgr.AddConsole(null);
                    g_modDebugMgr.AddDebugButton("ButtonCustomID2", function() {
                        console.log('ButtonCustomID2');
                        console.log(self.instrumentIdentifier);
                    });
                    g_modDebugMgr.AddDebugButton("ButtonCustomTemplateID2", function() {
                        console.log('ButtonCustomTemplateID2');
                        console.log(self.templateID);
                    });
                    g_modDebugMgr.AddDebugButton("ButtonCustomSource2", function() {
                        console.log('ButtonCustomSource2');
                        console.log(window.document.documentElement.outerHTML);
                    });
                } else {
                    setTimeout(() => {
                        self.isDebugEnabled();
                    }, 2000);
                }
            });
        }//*/
    }
	
	onBtnToggleLockMapValidated() {
		this.paramLockView = this.btnToggleGpsTracking.toggled;
		
		if (this.btnToggleGpsTracking.toggled && GoogleMap) {
			GoogleMap.setCenter(GoogleMapMarker.getPosition());
		}
	}
	
	onToggleTerrain() {
		if (!GoogleMap) return;
		if (this.btnToggleTerrain.toggled) {
			GoogleMap.setMapTypeId(google.maps.MapTypeId.TERRAIN);
		} else {
			GoogleMap.setMapTypeId(google.maps.MapTypeId.HYBRID);
		}
	}
	
	triggerClickEvent(btn, timeout=300) {
		setTimeout(() => { eventFire(btn, 'click'); }, timeout);
	}
	
	registerFlightPlanUpdate() {
		let flightPlanInterval = setInterval(this.updateFlightPlanCb.bind(this), 10000);
		this.addToIntervals(flightPlanInterval);
	}
	
	updateFlightPlanCb() {
		this.waypointsBatch = new SimVar.SimVarBatch("C:fs9gps:FlightPlanWaypointsNumber", "C:fs9gps:FlightPlanWaypointIndex");
		this.waypointsBatch.add("C:fs9gps:FlightPlanWaypointICAO", "string", "string");
		this.waypointsBatch.add("C:fs9gps:FlightPlanWaypointIdent", "string", "string");
		this.waypointsBatch.add("C:fs9gps:FlightPlanWaypointType", "number", "number");
		this.waypointsBatch.add("C:fs9gps:FlightPlanWaypointDistance", "nautical miles", "number");
		this.waypointsBatch.add("C:fs9gps:FlightPlanWaypointDistanceTotal", "nautical miles", "number");
		this.waypointsBatch.add("C:fs9gps:FlightPlanWaypointLatitude", "degrees", "number");
		this.waypointsBatch.add("C:fs9gps:FlightPlanWaypointLongitude", "degrees", "number");
		this.waypointsBatch.add("C:fs9gps:FlightPlanWaypointMagneticHeading", "degrees", "number");

		if (this._flightPlanPolyline) {
			this._flightPlanPolyline.setMap(null);
		}

		SimVar.GetSimVarArrayValues(this.waypointsBatch, (res) => {
			const flightPlanCoordinates = res.map(x => ({
				lat: x[5],
				lng: x[6]
			}));

			this._flightPlanPolyline = new google.maps.Polyline({
				path: flightPlanCoordinates,
				geodesic: true,
				strokeColor: "#dd0000",
				strokeOpacity: 0.7,
				strokeWeight: 4,
			});
			this._flightPlanPolyline.setMap(GoogleMap);
		});
	}
	
	registerPlaneUpdate() {
		let planeUpdateInterval = setInterval(this.onPlaneUpdateCb.bind(this), 1000);
		this.addToIntervals(planeUpdateInterval);
	}
	
	onPlaneUpdateCb() {
		let lat = SimVar.GetSimVarValue("PLANE LATITUDE", "degree latitude");
		let lng = SimVar.GetSimVarValue("PLANE LONGITUDE", "degree longitude");
		
		if (GoogleMapMarker != null && lat != null && lng != null) {
			GoogleMapMarker.setPosition({lat: lat, lng: lng});
		}
		
		let gpsete = SimVar.GetSimVarValue("GPS ETE", "seconds");
		if (gpsete) {
			this.lblEte.innerHTML = "ETE: " + formatSecToHHMMSS(gpsete);
		}
		
		if (this.btnToggleGpsTracking.toggled) {
			if (GoogleMap != null && lat != null && lng != null) {
				GoogleMap.setCenter({lat: lat, lng: lng});
			}
		}
	}
	
	onPlaneShowToggled() {
		if (GoogleMapMarker) {
			if (this.btnShowPlane.toggled) {
				GoogleMapMarker.setMap(GoogleMap);
			} else {
				GoogleMapMarker.setMap(null);
				if (this.btnToggleGpsTracking.toggled) {
					this.triggerClickEvent(this.btnToggleGpsTracking, 100);
				}
			}
		}
	}
	
    connectedCallback() {
        var self = this;

        this.m_MainDisplay = document.querySelector("#MainDisplay");
        this.m_Footer = document.querySelector("#Footer");
        
		// getting event from a toogle button
        /*this.m_ButtonElement = document.querySelector("#DeviceType");
        this.m_ImageElement = document.getElementById("DeviceImage");
        this.m_ButtonElement.addEventListener("OnValidate", (e) => {
            this.updateImage();
        });*/
		
		/*Include.addScript("/JS/debug.js", function () {
			g_modDebugMgr.AddConsole(null);
		});//*/
		
		// setup toggle gps lock
		this.btnToggleGpsTracking = this.querySelector("#btnToggleGpsTracking");
        if (this.btnToggleGpsTracking) {
            this.btnToggleGpsTracking.addEventListener("OnValidate", this.onBtnToggleLockMapValidated.bind(this));
			this.triggerClickEvent(this.btnToggleGpsTracking);
        }
		
		this.btnToggleTerrain = this.querySelector("#btnToggleTerrain");
		if (this.btnToggleTerrain) {
			this.btnToggleTerrain.addEventListener("OnValidate", this.onToggleTerrain.bind(this));
		}
		
		this.btnShowPlane = this.querySelector("#btnShowPlane");
		if (this.btnShowPlane) {
			this.btnShowPlane.addEventListener("OnValidate", this.onPlaneShowToggled.bind(this));
		}
		
		this.lblEte = this.querySelector("#lblEte");
		this.lblApMaster = this.querySelector("#lblApMaster");
		
		this._flightPlanPolyline = null;
		
		this.domEl_btnResetElevatorTrimOnApOff = document.querySelector("#btnResetElevatorTrimOnApOff");

			
		setTimeout(() => {
			if (!GoogleMap) return;
			google.maps.event.addListener(GoogleMap, 'dragstart', () => {
				if (!this.btnToggleGpsTracking.toggled) return;
				this.triggerClickEvent(this.btnToggleGpsTracking);
			});
		}, 5000);
			
		this.valApMaster = this.getSimVarApMaster();
		this.triggerClickEvent(this.domEl_btnResetElevatorTrimOnApOff);
		this.registerListeners();
		
		setTimeout(this.initGoogleMap.bind(this), 1000);
		
		this.domEl_elTrimMinus = document.querySelector("#elTrimMinus");
		this.domEl_elTrimReset = document.querySelector("#elTrimReset");
		this.domEl_elTrimPlus = document.querySelector("#elTrimPlus");
		this.domEl_ailTrimMinus = document.querySelector("#ailTrimMinus");
		this.domEl_ailTrimReset = document.querySelector("#ailTrimReset");
		this.domEl_ailTrimPlus = document.querySelector("#ailTrimPlus");
		this.domEl_rudTrimMinus = document.querySelector("#rudTrimMinus");
		this.domEl_rudTrimReset = document.querySelector("#rudTrimReset");
		this.domEl_rudTrimPlus = document.querySelector("#rudTrimPlus");
		
		this.domEl_elTrimMinus.addEventListener("OnValidate", () => {
			this.changeElevatorTrimPosition(-1);
		});
		this.domEl_elTrimReset.addEventListener("OnValidate", () => {
			this.setSimVarResetElevatorTrim();
		});
		this.domEl_elTrimPlus.addEventListener("OnValidate", () => {
			this.changeElevatorTrimPosition(1);
		});
		
		this.domEl_ailTrimMinus.addEventListener("OnValidate", () => {
			this.changeAileronPosition(-1);
		});
		this.domEl_ailTrimReset.addEventListener("OnValidate", () => {
			this.setSimVarResetAileronTrim();
		});
		this.domEl_ailTrimPlus.addEventListener("OnValidate", () => {
			this.changeAileronPosition(1);
		});
		
		this.domEl_rudTrimMinus.addEventListener("OnValidate", () => {
			this.changeRudderTrim(-1);
		});
		this.domEl_rudTrimReset.addEventListener("OnValidate", () => {
			this.setSimVarResetRudderTrim();
		});
		this.domEl_rudTrimPlus.addEventListener("OnValidate", () => {
			this.changeRudderTrim(1);
		});
    }
	
	changeElevatorTrimPosition(dir) {
		const step = 0.34*dir;
		let elval = this.getSimVar("ELEVATOR TRIM POSITION", "Radians");
		elval += (step/100.0);
		SimVar.SetSimVarValue("ELEVATOR TRIM POSITION", "Radians", elval);
	}
	
	changeAileronPosition(dir) {
		// -1 left, 1 right
		const step = 1*dir;
		let ailTrimPct = this.getSimVar("AILERON TRIM PCT", "Float");
		ailTrimPct += (step/100.0);
		SimVar.SetSimVarValue("AILERON TRIM PCT", "Float", ailTrimPct);
	}
	
	changeRudderTrim(dir) {
		// -1 left, 1 right
		const step = 1*dir;
		let rudTrimPct = this.getSimVar("RUDDER TRIM PCT", "Float");
		rudTrimPct += (step/100.0);
		SimVar.SetSimVarValue("RUDDER TRIM PCT", "Float", rudTrimPct);
	}
	
	registerListeners() {
		this.registerApListener();
		this.registerFlightPlanUpdate();
		this.registerPlaneUpdate();
		this.registerHeadingMarkerListener();
	}
	
	registerApListener() {
		let apListnerInterval = setInterval(this.apListenerCb.bind(this), 60);
		this.addToIntervals(apListnerInterval);
	}
	
	addToIntervals(interval) {
		this._intervals.push(interval);
	}
	
	apListenerCb() {
		this.resetElTrimOnApOff();	
		
		this.updateTrimLabels();
		this.updateApMasterLabel();
	}
	
	resetElTrimOnApOff() {
		let newApVal = this.getSimVarApMaster();
		let oldApVal = this.valApMaster;
		
		if (!newApVal && oldApVal) {
			if (this.domEl_btnResetElevatorTrimOnApOff.toggled) {
				this.setSimVarResetElevatorTrim();
			}
		}
		
		this.valApMaster = newApVal;
	}
	
	updateTrimLabels() {
		let elevPos = this.getSimVar("ELEVATOR POSITION", "number");
		let elevatorPct = this.getSimVar("ELEVATOR TRIM PCT", "number");
		
		let ailpos = this.getSimVar("AILERON POSITION", "number");
		let aileronPct = this.getSimVar("AILERON TRIM PCT", "number");
		
		let ruddpos = this.getSimVar("RUDDER POSITION", "number");
		let ruddtrimpct = this.getSimVar("RUDDER TRIM PCT", "number");
		
		let eltitle = `EL: ${Math.round(elevPos*100)}% (${Math.round(elevatorPct*100)}%)`;
		this.domEl_elTrimReset.setAttribute("title", eltitle);
		
		let ailtitle = `AIL: ${Math.round(ailpos*100)}% (${Math.round(aileronPct*100)}%)`;
		this.domEl_ailTrimReset.setAttribute("title", ailtitle);
		
		let rudtitle = `RD: ${Math.round(ruddpos*100)}% (${Math.round(ruddtrimpct*100)}%)`;
		this.domEl_rudTrimReset.setAttribute("title", rudtitle);
	}
	
	updateApMasterLabel() {
		if (this.lblApMaster) {
			if (this.valApMaster) {
				this.lblApMaster.classList.add('apmasteron');
			} else {
				this.lblApMaster.classList.remove('apmasteron');
			}
		}
	}
	
	getSimVar(value, type) {
		return SimVar.GetSimVarValue(value, type);
	}
	
	getSimVarApMaster() {
		return SimVar.GetSimVarValue("AUTOPILOT MASTER", "Boolean");
	}
	
	setSimVarResetElevatorTrim() {
		SimVar.SetSimVarValue("ELEVATOR TRIM POSITION", "Radians", 0.0);
	}
	
	setSimVarResetAileronTrim() {
		SimVar.SetSimVarValue("AILERON TRIM PCT", "number", 0.0);
	}
	
	setSimVarResetRudderTrim() {
		SimVar.SetSimVarValue("RUDDER TRIM PCT", "number", 0.0);
	}
	
	setSimVar(name, type, value) {
		SimVar.SetSimVarValue(name, type, value);
	}
	
    updateImage() {
    }
	
	initGoogleMap(param) {
		// The location of Uluru
		const uluru = { lat: -25.344, lng: 131.036 };
		
		// The map, centered at Uluru
		GoogleMap = new google.maps.Map(document.getElementById("map"), {
			zoom: 10,
			center: uluru,
			streetViewControl: false,
			clickableIcons: false,
			disableDefaultUI : false,
			mapTypeControl: false,
			fullscreenControl: false,
			mapTypeId: google.maps.MapTypeId.HYBRID,
			gestureHandling: 'greedy',
		});
		
		// The marker, positioned at Uluru
		GoogleMapMarker = new google.maps.Marker({
			position: uluru,
			icon: {
				url: 'plane32.png',
				size: new google.maps.Size(64, 64),
				anchor: new google.maps.Point(32, 32)
			},
			map: GoogleMap,
		});
		var overlay = new google.maps.OverlayView();
		overlay.draw = function() {
			this.getPanes().markerLayer.id = 'markerLayer';
		}
		overlay.setMap(GoogleMap);
		
		this.triggerClickEvent(this.btnShowPlane, 100);

		//setTimeout(disableCenterMyLocationBtn(GoogleMap), 300);
	}
	
	registerHeadingMarkerListener() {
		let changeMarkerInterval = setInterval(this.changeMarkerHeading.bind(this), 500);
		this.addToIntervals(changeMarkerInterval);
	}
	
	changeMarkerHeading() {
		if (!GoogleMapMarker) {
			return;	
		}
		let hdg = SimVar.GetSimVarValue("PLANE HEADING DEGREES TRUE", "radians");
		var el = document.querySelector('#markerLayer img')
		if (!!el) {
			el.style.transform = 'rotate(' + hdg + 'rad)';
		}
	}
}
window.customElements.define("ingamepanel-maps", IngamePanelMaps);
checkAutoload();

		function disableCenterMyLocationBtn(map) {
			// not called
			if (!!!map) return;
			map.setMyLocationEnabled(false);
			map.getUiSettings().setMyLocationButtonEnabled(false);
		}
		
		function formatSecToHHMMSS(sec) {
			let min = Math.floor(sec/60);
			let seconds = sec%60;
			return min + ":" + (seconds < 10 ? "0" : "") + seconds;
		}

		function initGoogleMap() {
			//google.maps.event.clearListeners(GoogleMap, 'idle');
		}
		
		function changeMarker() {
			if (!GoogleMapMarker) return;
			let hdg = SimVar.GetSimVarValue("PLANE HEADING DEGREES TRUE", "radians");
			var el = document.querySelector('#markerLayer img')
			if (!!el) {
				el.style.transform = 'rotate(' + hdg + 'rad)';
			}
			//google.maps.event.clearListeners(GoogleMap, 'idle');
		}
