import * as THREE from './build/three.module.js';
import { PointerLockControls } from './examples/jsm/controls/PointerLockControls.js';
import {InputManager, wrapText, PickHelper, get_time_passed} from './modules.js';

const GET_STATUS_URL = "http://127.0.0.1:5000/get_status"

const GET_RESULTS_URL = "http://127.0.0.1:5000/get_results"

var globals = {now: 0, then: 0, delta_time: 0};

const SPEEDS = {gspeed: 4};

var SIGHT_RANGE = 60;

const XSPACING = 10;

const ZSPACING = 10;

var data = [];

var data_range = {'xmax':0, 'zmax': 0};

var is_on_scene = [];

var on_scene_twets = [];

var decodeHTML = function (html) {
	var txt = document.createElement('textarea');
	txt.innerHTML = html;
	return txt.value;
};

function init(){
    const canvas = document.querySelector('#c');
    const renderer = new THREE.WebGLRenderer({canvas, antialias: true});

    var scene = new THREE.Scene();
    var camera = new THREE.PerspectiveCamera(75, 2, 0.1, 200);

    var picked_url;

    var controls = new PointerLockControls( camera, document.body );
    const input_manager = new InputManager(window);

    const overlay = document.querySelector('#overlay');
    const res_btn = document.querySelector('#res_btn');
    const range_in = document.querySelector('#range_in');
    const uanme_span = document.querySelector('#uname');

    const progress_bar = document.querySelector('#progress_bar');
    const progress_view = document.querySelector('#progress_view');
    const progress_text = document.querySelector('#progress_text');
    const err_view = document.querySelector('#err_view');
    
    res_btn.addEventListener('click', () => {
        SIGHT_RANGE = parseInt(range_in.value);
        controls.lock();
    });

    scene.background = new THREE.Color('skyblue');

    const loadManager = new THREE.LoadingManager();
    const loader = new THREE.TextureLoader(loadManager);

    camera.position.x = 0;
    camera.position.z = 0;
    camera.position.y = 2;

    // setting up plane
    const plane_gm = new THREE.PlaneBufferGeometry(500, 500);
    const plane_texture = loader.load('res/img/grass2.png');
    const plane_mat = new THREE.MeshBasicMaterial({map: plane_texture});
    plane_texture.wrapS = THREE.RepeatWrapping;
    plane_texture.wrapT = THREE.RepeatWrapping;
    plane_texture.repeat.set(150, 150);

    const plane = new THREE.Mesh(plane_gm, plane_mat);
    plane.rotateX(-Math.PI / 2.0);

    scene.add(plane);

    let color = 0xFFFFFF;
    let intensity = 1;
    const light1 = new THREE.AmbientLight(color, intensity);
    scene.add(light1);

    const pickHelper = new PickHelper();

    var listener = new THREE.AudioListener();
    camera.add(listener);

    // create a global audio source
    var walking_sound = new THREE.Audio( listener );
    var talking_sound = new THREE.PositionalAudio( listener );

    // load a sound and set it as the Audio object's buffer
    var audioLoader = new THREE.AudioLoader();
    audioLoader.load('sounds/walk.ogg', function( buffer ) {
        walking_sound.setBuffer(buffer);
        walking_sound.setLoop(true);
        walking_sound.setVolume(0.5);
    });
    audioLoader.load('sounds/talk.ogg', function( buffer ) {
        talking_sound.setBuffer(buffer);
        talking_sound.setLoop(true);
        talking_sound.setVolume(0.2);
        talking_sound.setRefDistance(4);
        talking_sound.play();
    });


    controls.addEventListener( 'lock', () => {
        overlay.style.display = 'none';
        res_btn.innerHTML = "Resume";
    });
    
    controls.addEventListener( 'unlock',() => {
        overlay.style.display = 'block';
        range_in.value = SIGHT_RANGE;
    });

    function resizeRendererToDisplaySize(renderer) {
        const canvas = renderer.domElement;
        const width = canvas.clientWidth;
        const height = canvas.clientHeight;
        const needResize = canvas.width !== width || canvas.height !== height;
        if (needResize) {
          renderer.setSize(width, height, false);
        }
        return needResize;
    }

    function render(now) {

        show_tweets();

        globals.now = now * 0.001;  // converting to seconds
        globals.delta_time = globals.now - globals.then;
        globals.then = globals.now;
        
        // moving the camera
        let m1 = input_manager.keys.up.down || input_manager.keys.w.down;  // forward
        let m2 = input_manager.keys.right.down || input_manager.keys.d.down;  // right
        let m3 = input_manager.keys.down.down || input_manager.keys.s.down;  // back
        let m4 = input_manager.keys.left.down || input_manager.keys.a.down;  // left
        if (m1 || m3)
            controls.moveForward((m1 ? 1 : -1) * SPEEDS.gspeed * globals.delta_time);
        if (m2 || m4)
            controls.moveRight((m2 ? 1 : -1) * SPEEDS.gspeed * globals.delta_time);
        
        if (m1 || m2 || m3 || m4){
            if (!walking_sound.isPlaying)
                walking_sound.play();
        }
        else{
            walking_sound.pause();
        }

        if (input_manager.mouse.rightJustReleased){
            picked_url = pickHelper.pick({x: 0.5, y: 0.5}, scene, camera, now);
            if (picked_url !== undefined){
                window.open(picked_url, "_blank");
                console.log(picked_url);
            }
        }

        if (resizeRendererToDisplaySize(renderer)) {
            const canvas = renderer.domElement;
            camera.aspect = canvas.clientWidth / canvas.clientHeight;
            camera.updateProjectionMatrix();
        }
        
        input_manager.update();
        renderer.render( scene, camera );
        requestAnimationFrame( render );
    }

    function load_tweets(){
        var xhttp = new XMLHttpRequest();
        let url_string = window.location.href;
        let url = new URL(url_string);
        let id = url.searchParams.get("id");
        xhttp.onreadystatechange = function() {
            if (this.readyState == 4 && this.status == 200) {
                data = JSON.parse(this.responseText);
                uanme_span.innerHTML = "@" + data.uname;
                data = data.data;
                let act_xm = 0, act_zm = 0;
                data.forEach(element => {
                    is_on_scene.push(false);
                    on_scene_twets.push(undefined);
                    if (parseInt(element[22]) > data_range.xmax)
                        data_range.xmax = element[22];

                    if (parseInt(element[23]) > data_range.zmax)
                        data_range.zmax = element[23];
                    
                    if (parseInt(element[23]) >= act_zm){
                        act_zm = parseInt(element[23]);
                        if (parseInt(element[22]) >= act_xm)
                            act_xm = parseInt(element[22]);
                    }
                });
                var talk_sphere = new THREE.SphereBufferGeometry(2, 3, 3);
                var talk_material = new THREE.MeshBasicMaterial({ color: 0xff0000 });
                var talk_mesh = new THREE.Mesh(talk_sphere, talk_material);
                talk_mesh.visible = false;
                talk_mesh.position.set(act_xm * XSPACING - (data_range.xmax * XSPACING / 2) , 2, act_zm * ZSPACING - (data_range.zmax * ZSPACING / 2));
                scene.add(talk_mesh);

                // finally add the sound to the mesh
                talk_mesh.add(talking_sound);
            }
        };
        xhttp.open("GET", GET_RESULTS_URL + "?id=" + id, true);
        xhttp.send();
    }
    

    function draw_single_tweet(tweet_id){
        // data format: 1: tweet_id, 2: uname, 3: name, 4: profile_pic_url, 5: full_text, 6: image1_url,
        // 7: image2_url, 8:image3_url, 9: image4_url, 10: vid_url, 11: vid_prev_url, 12: quote_uname,
        // 13: quote_name, 14: quote_profile_pic_url, 15:quote_tweet_text, 16: retweeted_by_uname,
        // 17: retweeted_by_name, 18: likes, 19: retweets, 20: created_at, 21: lang, 22: x, 23: y
        let tweet_d = data[tweet_id];
        let box_width = 8, box_height = 4;

        const ctx = document.createElement('canvas').getContext('2d');
        ctx.canvas.width = 1000;
        ctx.canvas.height = 500;

        let has_image = false;

        if (tweet_d[6] != "NULL" || tweet_d[11] != "NULL"){
            has_image = true;

            box_height += 2;
            ctx.canvas.height = 750;

            let img_1 = new Image;
            img_1.crossOrigin = "anonymous";
            img_1.src = (tweet_d[6]!= "NULL")?tweet_d[6]:tweet_d[11];
            img_1.onload = function(){
                ctx.drawImage(img_1, 0.04 * ctx.canvas.width, 0.35 * ctx.canvas.height, 0.92 * ctx.canvas.width, 0.6 * ctx.canvas.height); // Or at whatever offset you like
                texture.needsUpdate = true;
            };
        }

        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        
        let mode = "ltr"
        if (tweet_d[21] == 'fa' || tweet_d[21] == 'ar'){
            mode = "rtl";
        }

        let time_passed = ""
        let tweet_time_utc = Date.parse(tweet_d[20]) - ((new Date().getTimezoneOffset()) * 60 * 1000)
        time_passed = get_time_passed((Date.now() - tweet_time_utc) / 1000);

        if (has_image){
            wrapText(ctx, decodeHTML(tweet_d[5]), 0.04, 0.15, 0.92, 34, 28, "black", mode);

            wrapText(ctx, tweet_d[3], 0.1, 0.05, 0.9, 22, 22, "black", 'ltr');

            wrapText(ctx, "@"+tweet_d[2] + "   .   " + time_passed, 0.1, 0.09, 0.9, 22, 20, "gray", 'ltr');

            wrapText(ctx, tweet_d[18] + " ❤️", 0.04, 0.08, 0.9, 22, 24, "black", 'rtl');
        }
        else{
            wrapText(ctx, decodeHTML(tweet_d[5]), 0.04, 0.25, 0.92, 34, 28, "black", mode);

            wrapText(ctx, tweet_d[3], 0.1, 0.1, 0.9, 22, 22, "black", 'ltr');
            
            wrapText(ctx, "@"+tweet_d[2] + "   .   " + time_passed, 0.1, 0.15, 0.9, 22, 20, "gray", 'ltr');

            wrapText(ctx, tweet_d[18] + " ❤️", 0.04, 0.12, 0.9, 22, 24, "black", 'rtl');
        }
        
        const texture = new THREE.CanvasTexture(ctx.canvas);

        texture.magFilter = THREE.LinearFilter;
        texture.minFilter = THREE.LinearFilter;
        texture.wrapS = THREE.ClampToEdgeWrapping;
        texture.wrapT = THREE.ClampToEdgeWrapping;
        
        let profile_img = new Image;
        profile_img.crossOrigin = "anonymous";
        profile_img.src = tweet_d[4];
        profile_img.onload = function(){
            if (has_image)
                ctx.drawImage(profile_img, 0.04 * ctx.canvas.width, 0.03 * ctx.canvas.height);
            else
                ctx.drawImage(profile_img, 0.04 * ctx.canvas.width, 0.06 * ctx.canvas.height);
            texture.needsUpdate = true;
        };

        const box_gm = new THREE.BoxBufferGeometry(box_width, box_height, 0.3);
        // const box_mat = new THREE.MeshBasicMaterial({map: texture});
        const box_mat = [                                                      
            new THREE.MeshBasicMaterial( { color: 0xFFFFFF } ),                      
            new THREE.MeshBasicMaterial( { color: 0xFFFFFF } ),                      
            new THREE.MeshBasicMaterial( { color: 0xFFFFFF } ),                      
            new THREE.MeshBasicMaterial( { color: 0xFFFFFF } ),                      
            new THREE.MeshBasicMaterial( {map: texture} ),                      
            new THREE.MeshBasicMaterial( {map: texture} )                       
        ];
        
        
        const box_mesh = new THREE.Mesh(box_gm, box_mat);

        box_mesh.data = {'url': 'http://twitter.com/' + tweet_d[2] + '/status/' + tweet_d[1]};

        box_mesh.position.set(parseInt(tweet_d[22]) * XSPACING - (data_range.xmax * XSPACING / 2) , box_height / 2.0, parseInt(tweet_d[23]) * ZSPACING - (data_range.zmax * ZSPACING / 2));
        // box_mesh.position.set(0, 2, 0);

        scene.add(box_mesh);

        on_scene_twets[tweet_id] = box_mesh;
        is_on_scene[tweet_id] = true;
    }

    function show_tweets(){
        let cx = parseFloat(camera.position['x']);
        let cz = parseFloat(camera.position['z']);

        on_scene_twets.forEach((tw, i) => {
            if (tw === undefined){}
            else{
                let tx = parseFloat(tw.position['x']);
                let tz = parseFloat(tw.position['z']);

                if (Math.sqrt(Math.pow(cx-tx, 2)+Math.pow(cz-tz, 2)) > SIGHT_RANGE){
                    scene.remove(tw);
                    tw.geometry.dispose();
                    tw.material.forEach(element => {
                        element.dispose();
                    });
                    tw = undefined;
                    is_on_scene[i] = false;
                    on_scene_twets[i] = undefined;
                }
            }
        });
        

        for (let i = 0; i< data.length; i++){
            let element = data[i];
            let tx = parseInt(element[22]) * XSPACING - (data_range.xmax * XSPACING / 2);
            let tz = parseInt(element[23]) * ZSPACING - (data_range.zmax * ZSPACING / 2);
            if (Math.sqrt(Math.pow(cx-tx, 2)+Math.pow(cz-tz, 2)) < SIGHT_RANGE){
                if (!is_on_scene[i]){
                    draw_single_tweet(i);
                }
                
            }
        } 
    }

    function check_progress(){
        var xhttp = new XMLHttpRequest();
        let url_string = window.location.href;
        let url = new URL(url_string);
        let id = url.searchParams.get("id");
        xhttp.onreadystatechange = function() {
            if (this.readyState == 4 && this.status == 200) {
                let res = JSON.parse(this.responseText);
                let state = res.state;
                if (state == "PROGRESS"){
                    console.log("dc", res.current);
                    progress_bar.value = res.current;
                    progress_text.innerHTML = res.current + "%";
                    setTimeout(check_progress, 300);
                }
                else if (state == "FAILURE"){
                    err_view.innerHTML = "An error occured :( <br>" + res.msg;
                }
                else if (state == "COMPLETED"){
                    progress_view.style.display = 'none';
                    load_tweets();
                }
            }
        };
        xhttp.open("GET", GET_STATUS_URL + "?id=" + id, true);
        xhttp.send();
    }

    requestAnimationFrame( render );
    check_progress();
}
init();