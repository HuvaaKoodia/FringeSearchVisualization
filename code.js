// Constructor for Tile objects to hold data for all drawn objects.
// For now they will just be defined as rectangles.
function Tile(id, gx, gy, x, y, w, h) {
	this.gx = gx;
	this.gy = gy;
	this.x = x || 0;
	this.y = y || 0;
	this.w = w || 1;
	this.h = h || 1;
	this.hashId = id;
	
	this.text = "";
	this.blocked = false;

	this.text_index = 0;
	this.parents = [];
	this.f = 0;
	this.g = 0;
}

Tile.prototype.toString = function () {
	return this.gx + "" + this.gy;
}

// Draws this shape to a given context
Tile.prototype.draw = function (ctx) {

	ctx.beginPath();

	if (this.blocked) {
		ctx.fillStyle = 'gray';
		ctx.fillRect(this.x, this.y, this.w, this.h);
	}
	ctx.strokeStyle = 'black';
	ctx.rect(this.x, this.y, this.w, this.h);

	ctx.font = "16px Arial";

	if (this.text_index == 0)
		ctx.strokeText(this.text, this.x + 2, this.y + this.h / 2);
	else
		ctx.strokeText(this.text_index, this.x + 2, this.y + this.h / 2);

	ctx.stroke();
}

// Determine if a point is inside the shape's bounds
Tile.prototype.contains = function (mx, my) {
	// All we have to do is make sure the Mouse X,Y fall in the area between
	// the shape's X and (X + Height) and its Y and (Y + Height)
	return (this.x <= mx) && (this.x + this.w >= mx) &&
	(this.y <= my) && (this.y + this.h >= my);
}

Tile.prototype.heuristicTo = function (other) {
	var xd = this.gx - other.gx,
	yd = this.gy - other.gy;
	//return Math.abs(xd)+Math.abs(yd); manhattan
	var dis = Math.sqrt(xd * xd + yd * yd);
	return dis;
}

Tile.prototype.heuristicFromTo = function (start, goal) {
	var start_dis = start.heuristicTo(goal);
	var goal_dis = this.heuristicTo(goal);
	var dif = goal_dis - start_dis;
	if (dif > 0) goal_dis += start_dis;
	return goal_dis;
}

function CanvasState(canvas) {
	// **** First some setup! ****

	this.canvas = canvas;
	this.width = canvas.width;
	this.height = canvas.height;
	this.gw = 0;
	this.gh = 0;
	this.ctx = canvas.getContext('2d');
	// This complicates things a little but but fixes mouse co-ordinate problems
	// when there's a border or padding. See getMouse for more detail
	var stylePaddingLeft,
	stylePaddingTop,
	styleBorderLeft,
	styleBorderTop;
	if (document.defaultView && document.defaultView.getComputedStyle) {
		this.stylePaddingLeft = parseInt(document.defaultView.getComputedStyle(canvas, null)['paddingLeft'], 10) || 0;
		this.stylePaddingTop = parseInt(document.defaultView.getComputedStyle(canvas, null)['paddingTop'], 10) || 0;
		this.styleBorderLeft = parseInt(document.defaultView.getComputedStyle(canvas, null)['borderLeftWidth'], 10) || 0;
		this.styleBorderTop = parseInt(document.defaultView.getComputedStyle(canvas, null)['borderTopWidth'], 10) || 0;
	}
	// Some pages have fixed-position bars (like the stumbleupon bar) at the top or left of the page
	// They will mess up mouse coordinates and this fixes that
	var html = document.body.parentNode;
	this.htmlTop = html.offsetTop;
	this.htmlLeft = html.offsetLeft;

	//directions
	this.directions = [
		{x : 1, y : 0}, 
		{x :-1, y : 0},
		{x : 0, y : 1},
		{x : 0, y :-1}
	]

	// **** Keep track of state! ****

	this.dragging = false;

	this.valid = false; // when set to false, the canvas will redraw everything
	this.shapes = []; // the collection of things to be drawn

	this.paintOn = true;
	this.creatingWalls = false;
	this.selected_tile = null,
	start_tile = null,
	goal_tile = null;

	// **** Input events! ****

	var myState = this;

	canvas.addEventListener('mousedown', function (e) {
		myState.dragging = true;

		var mouse = myState.getMouse(e);
		var mx = mouse.x;
		var my = mouse.y;
		var shapes = myState.shapes;
		var l = shapes.length;
		//select
		for (var i = l - 1; i >= 0; i--) {
			if (shapes[i].contains(mx, my)) {
				var mySel = shapes[i];

				if (myState.selected_tile != mySel) {
					myState.paintOn = !mySel.blocked;

					myState.selected_tile = mySel;
					myState.valid = false;
				}
				return;
			}
		}
	}, true);

	canvas.addEventListener('mousemove', function (e) {
		if (!myState.dragging)
			return;
		var mouse = myState.getMouse(e);
		var mx = mouse.x;
		var my = mouse.y;
		var shapes = myState.shapes;
		var l = shapes.length;
		//select
		for (var i = l - 1; i >= 0; i--) {
			if (shapes[i].contains(mx, my)) {
				var mySel = shapes[i];

				if (!myState.creatingWalls) myState.paintOn = !mySel.blocked;

				myState.selected_tile = mySel;
				myState.valid = false;
				return;
			}
		}
	}, true);

	canvas.addEventListener('mouseup', function (e) {
		myState.dragging = false;
	}, true);

	canvas.addEventListener('keyup', function (e) {
		e = e || window.event;

		if (!myState.pathfinder_on) {
			if (e.keyCode == 83) { //s
				if (myState.selected_tile.blocked || myState.selected_tile == myState.goal_tile) return;

				myState.SetStartTile(myState.selected_tile);
			}
			if (e.keyCode == 71) { //g
				if (myState.selected_tile.blocked || myState.selected_tile == myState.start_tile) return;

				myState.SetGoalTile(myState.selected_tile);
			}

			if (e.keyCode == 87) { //w
				myState.paintOn = !myState.paintOn;
				myState.creatingWalls = false;
			}
		}

		if (e.keyCode == 78) { //n
			//start/continue pathfinder
			if (!myState.pathfinder_on) {
				myState.pathfinder = myState.UpdatePathfinder();
			}
			myState.pathfinder.next();
		}

		if (e.keyCode == 82) { //r
			myState.ResetGrid();
			myState.ResetPathfinder();
		}

		if (e.keyCode == 77) { //m
			myState.ResetPathfinder();
		}

		if (e.keyCode == 84) { //t
			//test
			console.log("current:");
			console.log(myState.selected_tile);
			console.log("adjacent:");
			for (var i = 0; i < 4; ++i) {
				var d = myState.directions[i];
				console.log(myState.GetTile(myState.selected_tile.gx, myState.selected_tile.gy, d.x, d.y));
			}
		}

		if (e.keyCode == 65) { //a
			myState.auto_simulate = !myState.auto_simulate;
		}

		if (e.keyCode == 73) { //i
			myState.do_yield = !myState.do_yield;
		}

		if (e.keyCode == 72) { //h
			myState.help_on = !myState.help_on;
		}

		myState.valid = false;

	}, false);

	canvas.addEventListener('keydown', function (e) {
		e = e || window.event;

		if (!myState.pathfinder_on) {
			if (e.keyCode == 87) { //w
				myState.creatingWalls = true;
			}
		}
		myState.valid = false;
	}, false);

	// **** Options! ****

	this.help_on = true;
	this.selectionColor = '#CC0000';
	this.selectionWidth = 2;
	this.interval = 30;
	setInterval(function () {
		myState.draw();
	}, myState.interval);

	//pathfinder algorithm state
	this.pathfinder;
	this.pathfinder_on = false;
	this.now_list = [];
	this.later_list = [];
	this.g_cache = {};
	this.full_path = [];
	this.current_n;

	this.do_yield = true;

	this.auto_simulate = true;
	this.auto_index = 0;
	this.auto_delay = 0;

	this.f_limit;
	this.f_min;

	//path finder stats
	this.tile_check_amount = 0;
	this.tile_child_check_amount = 0;
	this.pathfinder_time = 0;
}

CanvasState.prototype.ResetGrid = function () {
	for (var i = 0; i < this.shapes.length; ++i) {
		this.shapes[i].blocked = false;
	}
}

CanvasState.prototype.ResetPathfinder = function () {
	this.g_cache = {};
	this.now_list.length = 0;
	this.later_list.length = 0;
	this.full_path.length = 0;
	this.current_n = null;

	this.pathfinder_on = false;

	this.tile_child_check_amount = 0;
	this.tile_check_amount = 0;

	for (var i = 0; i < this.shapes.length; ++i) {
		var tile = this.shapes[i];
		tile.text_index = 0;
		tile.f = 0;
		tile.parents.length = 0;
	}
}

CanvasState.prototype.UpdatePathfinder = function () {
	if (this.start_tile == null || this.goal_tile == null)
		yield false;

	//timer, not implemented
	var time = 0;

	//set up
	this.ResetPathfinder();

	this.f_limit = this.start_tile.heuristicTo(this.goal_tile);
	this.found = false;

	//set up starting now list
	this.now_list.push(this.start_tile);

	var state = this;
	var addToCache = function (tile, value) {
		state.g_cache[tile.hashId] = {
			t : tile,
			v : value
		};
	}

	addToCache(this.start_tile, 1);

	this.pathfinder_on = true;
	var found = false;
	while (!found) {
		this.f_min = 9999999999;
		var f_min_changed = false;
		//var l=this.now_list.length;
		var noTilesLeftToCheck = true;
		var i = 0;
		var l = this.now_list.length;
		for (; i < this.now_list.length; ++i) {
			var n = this.now_list[i];
			this.current_n = n;

			++this.tile_check_amount;

			if (this.do_yield) yield undefined;

			//cost to this node
			var g = this.g_cache[n.hashId].v;
			//cost to search from this node
			var f = g + n.heuristicFromTo(this.start_tile, this.goal_tile);
			n.f = f;
			
			if (n == this.goal_tile) {
				found = true;
				break;
			}

			if (f > this.f_limit) {
				//use the smallest f value possible 
				this.f_min = Math.min(f, this.f_min);
				f_min_changed = true;
				noTilesLeftToCheck = false;
				continue;
			}

			//iterate children
			for (var j = 0; j < 4; ++j) {
				var d = this.directions[j];
				var s = this.GetTile(n.gx, n.gy, d.x, d.y);

				++this.tile_child_check_amount;

				if (s == null || s.blocked) continue;
				noTilesLeftToCheck = false;

				
				var gs = g + 1;
				var gt = this.g_cache[s.hashId];
				if (gt != undefined) {
					if (gs >= gt.v) {
						continue; //this child was tested before with better results
					}
				}

				//set tile text
				if (s != this.start_tile && s != this.goal_tile) s.text_index = gs;

				s.parents.push(n);
				s.g = gs;

				//later list used for visualization only
				this.later_list.push(s);
				//remove from now list
				var index = this.now_list.indexOf(s);
				if (index != -1) {
					this.now_list.splice(index, 1);
				}
				//add into next iteration
				this.now_list.splice(i + 1, 0, s);
				addToCache(s, gs);
				
				//limit f value to found child to avoid critical f value increase in certain cases
				if (gs< this.f_min) 
				{
					this.f_limit = Math.min(gs, this.f_min);
				}
			}
			this.now_list.splice(i, 1);
			--i;
			if (this.do_yield) yield undefined;
		}
		this.later_list.length = 0;
		if (!found) {
			if (f_min_changed) {
				this.f_limit =  this.f_min;
			}
			else if (noTilesLeftToCheck){
				break;
			}

			if (this.do_yield) yield undefined;
		}
	}

	if (found) {
		//create path
		var tile = this.goal_tile;
		while (tile != null && tile != this.start_tile) {
			this.full_path.push(tile);

			var min = tile.g * 2;
			var next = null;
			for (var k = 0; k < tile.parents.length; ++k) {
				var parent = tile.parents[k];
				if (parent.g < min) {
					next = parent;
					min = parent.g;
				}
			}
			tile = next;
		}
	}

	this.current_n = null;
	this.pathfinder_time = time;
	this.pathfinder_on = false;
	yield false;
}

CanvasState.prototype.GetTile = function (x, y, dx, dy) {
	if (x + dx < 0 || x + dx >= this.gw || y + dy < 0 || y + dy >= this.gh)
		return null;

	var min_x = y * this.gw;

	if (dy == 0) {
		var xx = min_x + x + dx;
		return this.shapes[xx];
	} else {
		if (dy > 0) {
			var yy = min_x + x + this.gw;
			return this.shapes[yy];
		} else {
			var yy = min_x + x - this.gw; ;
			return this.shapes[yy];
		}
	}
}


CanvasState.prototype.SetStartTile = function (tile){
	if (tile != null) {
		if (this.start_tile != null) {
			this.start_tile.text = "";
		}
		this.start_tile = tile;
		this.start_tile.text = "S";
	}
}

CanvasState.prototype.SetGoalTile = function (tile){
	if (tile != null) {
		if (this.goal_tile != null) {
			this.goal_tile.text = "";
		}
		this.goal_tile = tile;
		this.goal_tile.text = "G";
	}
}

CanvasState.prototype.addShape = function (shape) {
	this.shapes.push(shape);
	this.valid = false;
}

CanvasState.prototype.createGrid = function (width, height) {
	this.gw = width;
	this.gh = height;
	var start_x = 10,
	start_y = 10,
	tile_w = 32,
	tile_h = 32;

	var id = 0;
	for (var h = 0; h < height; ++h) {
		for (var w = 0; w < width; ++w) {
			this.shapes.push(new Tile(id++, w, h, start_x + w * tile_w, start_y + h * tile_h, tile_w, tile_h));
		}
	}
	
	//set default start and end positons
	var startTile = this.GetTile(width/4, height/4, 0, 0);
	this.SetStartTile(startTile);
	
	var goalTile = this.GetTile(width - width/4, height - height/4, 0, 0);
	this.SetGoalTile(goalTile);
	
	this.valid = false;
}

CanvasState.prototype.clear = function () {
	this.ctx.clearRect(0, 0, this.width, this.height);
}

// While draw is called as often as the INTERVAL variable demands,
// It only ever does something if the canvas gets invalidated by our code
CanvasState.prototype.draw = function () {
	// if our state is invalid, redraw and validate!
	if (this.valid)
		return;

	var ctx = this.ctx;
	var shapes = this.shapes;
	this.clear();

	// now list
	var l = this.now_list.length;
	for (var i = 0; i < l; i++) {
		var shape = this.now_list[i];

		ctx.fillStyle = "green";
		ctx.fillRect(shape.x, shape.y, shape.w, shape.h);
	}

	//later list
	var l = this.later_list.length;
	for (var i = 0; i < l; i++) {
		var shape = this.later_list[i];

		ctx.fillStyle = "orange";
		ctx.fillRect(shape.x, shape.y, shape.w, shape.h);
	}

	//path
	var l = this.full_path.length;
	for (var i = 0; i < l; i++) {
		var shape = this.full_path[i];

		ctx.fillStyle = "red";
		ctx.fillRect(shape.x, shape.y, shape.w, shape.h);
	}

	// all tiles
	var l = shapes.length;
	for (var i = 0; i < l; i++) {
		var shape = shapes[i];
		shapes[i].draw(ctx);
	}

	// draw selected_tile
	if (this.selected_tile != null) {
		ctx.strokeStyle = this.selectionColor;
		ctx.lineWidth = this.selectionWidth;
		var mySel = this.selected_tile;
		ctx.strokeRect(mySel.x, mySel.y, mySel.w, mySel.h);
	}

	// draw current tile
	if (this.current_n != null) {
		ctx.strokeStyle = "magenta";
		ctx.lineWidth = this.selectionWidth;
		var mySel = this.current_n;
		ctx.strokeRect(mySel.x, mySel.y, mySel.w, mySel.h);
	}

	var cx = this.gw * 32 + 32,
	cy = 32,
	dif = 24;

	if (this.help_on) {
		//help
		ctx.fillStyle = "black";
		ctx.fillText("Help:", cx, cy);
		cy += dif;
		ctx.fillText("- - - - - - - - - - -", cx, cy);
		cy += dif;
		ctx.fillText("LMB: select tile.", cx, cy);
		cy += dif;
		ctx.fillText("S: set as start tile.", cx, cy);
		cy += dif;
		ctx.fillText("G: set as goal tile.", cx, cy);
		cy += dif;
		ctx.fillText("W: toggle as wall.", cx, cy);
		cy += dif;
		ctx.fillText("R: reset map.", cx, cy);
		cy += dif * 2;
		ctx.fillText("N: start/continue pathfinder.", cx, cy);
		cy += dif;
		ctx.fillText("M: reset pathfinder.", cx, cy);
		cy += dif;
		ctx.fillText("A: toggle autorun pathfinder.", cx, cy);
		cy += dif;
		ctx.fillText("I: toggle instant pathfinding.", cx, cy);
		cy += dif * 2;
		ctx.fillText("H: open/close help.", cx, cy);
		cy += dif;
		ctx.fillText("- - - - - - - - - - -", cx, cy);
		cy += dif * 2;
	}

	ctx.fillStyle = "black";
	if (!this.do_yield) {
		ctx.fillText("Instant", cx, cy);
	} else if (this.auto_simulate) {
		ctx.fillText("Auto", cx, cy);
	}

	cx = 10;
	cy = this.gh * 32 + 32;

	//stats
	if (this.tile_check_amount > 0) {
		ctx.fillText("Stats:", cx, cy);
		cy += dif * 1.5;
		ctx.fillText("Tile checks: " + this.tile_check_amount, cx, cy);
		cy += dif;
		ctx.fillText("Tile child checks: " + this.tile_child_check_amount, cx, cy);
		cy += dif;
		ctx.fillText("F limit: " + this.f_limit, cx, cy);
		cy += dif;
		if (this.pathfinder_time > 0) {
			ctx.fillText("Time: " + this.pathfinder_time, cx, cy);
			cy += dif;
		}
	}

	this.valid = true;

	//auto_update
	if (this.auto_simulate && this.pathfinder_on) {
		if (this.auto_index > 0) {
			--this.auto_index;
		} else {
			this.auto_index = this.auto_index_delay;
			this.pathfinder.next();
		}
		this.valid = false;
	}

	//paint walls
	if (this.creatingWalls && this.selected_tile != this.start_tile && this.selected_tile != this.goal_tile) {
		this.selected_tile.blocked = this.paintOn;
	}
}

// Creates an object with x and y defined, set to the mouse position relative to the state's canvas
// If you wanna be super-correct this can be tricky, we have to worry about padding and borders
CanvasState.prototype.getMouse = function (e) {
	var element = this.canvas,
	offsetX = 0,
	offsetY = 0,
	mx,
	my;

	// Compute the total offset
	if (element.offsetParent !== undefined) {
		do {
			offsetX += element.offsetLeft;
			offsetY += element.offsetTop;
		} while ((element = element.offsetParent));
	}

	// Add padding and border style widths to offset
	// Also add the <html> offsets in case there's a position:fixed bar
	offsetX += this.stylePaddingLeft + this.styleBorderLeft + this.htmlLeft;
	offsetY += this.stylePaddingTop + this.styleBorderTop + this.htmlTop;

	mx = e.pageX - offsetX;
	my = e.pageY - offsetY;

	// We return a simple javascript object (a hash) with x and y defined
	return {x : mx, y : my};
}

function init(canvasname) {
	var s = new CanvasState(document.getElementById(canvasname));
	s.createGrid(20, 20);
}
