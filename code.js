// Tile objects hold data for all drawn objects.
// For now they will just be defined as rectangles.
function Tile(id, gridX, gridY, x, y, w, h) {
	this.gridX = gridX;
	this.gridY = gridY;
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

// Draws this shape to a given context
Tile.prototype.Draw = function (ctx) {
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
Tile.prototype.Contains = function (mx, my) {
	// All we have to do is make sure the Mouse X,Y fall in the area between
	// the shape's X and (X + Height) and its Y and (Y + Height)
	return (this.x <= mx) && (this.x + this.w >= mx) &&
	(this.y <= my) && (this.y + this.h >= my);
}

Tile.prototype.HeuristicTo = function (other) {
	var xd = this.gridX - other.gridX,
	yd = this.gridY - other.gridY;
	//return Math.abs(xd)+Math.abs(yd); manhattan
	var dis = Math.sqrt(xd * xd + yd * yd);
	return dis;
}

Tile.prototype.HeuristicFromTo = function (start, goal) {
	var start_dis = start.HeuristicTo(goal);
	var goal_dis = this.HeuristicTo(goal);
	var dif = goal_dis - start_dis;
	if (dif > 0) goal_dis += start_dis;
	return goal_dis;
}

CanvasState.prototype.ResetGrid = function () {
	for (var i = 0; i < this.shapes.length; ++i) {
		this.shapes[i].blocked = false;
	}
}

CanvasState.prototype.ResetPathfinder = function () {
	this.gCache = {};
	this.nowList.length = 0;
	this.laterList.length = 0;
	this.fullPath.length = 0;
	this.currentN = null;

	this.pathfinderOn = false;

	this.tileChildCheckAmount = 0;
	this.tileCheckAmount = 0;

	for (var i = 0; i < this.shapes.length; ++i) {
		var tile = this.shapes[i];
		tile.text_index = 0;
		tile.f = 0;
		tile.parents.length = 0;
	}
}

CanvasState.prototype.UpdatePathfinder = function* () {
	if (this.startTile == null || this.goalTile == null)
		yield false;

	//Setup
	this.ResetPathfinder();

	this.fLimit = this.startTile.HeuristicTo(this.goalTile);
	this.found = false;

	//Starting now list
	this.nowList.push(this.startTile);

	var state = this;
	var addToCache = function (tile, value) {
		state.gCache[tile.hashId] = {
			t : tile,
			v : value
		};
	}

	addToCache(this.startTile, 1);

	this.pathfinderOn = true;
	var found = false;
	while (!found) {
		this.fMin = 9999999999;
		var f_min_changed = false;
		//var l=this.nowList.length;
		var noTilesLeftToCheck = true;
		var i = 0;
		var l = this.nowList.length;
		for (; i < this.nowList.length; ++i) {
			var n = this.nowList[i];
			this.currentN = n;

			++this.tileCheckAmount;

			if (this.doYield) yield;

			//Cost to this node
			var g = this.gCache[n.hashId].v;
			//Cost to search from this node
			var f = g + n.HeuristicFromTo(this.startTile, this.goalTile);
			n.f = f;
			
			if (n == this.goalTile) {
				found = true;
				break;
			}

			if (f > this.fLimit) {
				//Use the smallest f value possible 
				this.fMin = Math.min(f, this.fMin);
				f_min_changed = true;
				noTilesLeftToCheck = false;
				continue;
			}

			//Iterate children
			for (var j = 0; j < 4; ++j) {
				var d = this.directions[j];
				var s = this.GetTile(n.gridX, n.gridY, d.x, d.y);

				++this.tileChildCheckAmount;

				if (s == null || s.blocked) continue;
				noTilesLeftToCheck = false;

				var gs = g + 1;
				var gt = this.gCache[s.hashId];
				if (gt != undefined) {
					if (gs >= gt.v) {
						continue; //This child was tested before with better results
					}
				}

				//Set tile text
				if (s != this.startTile && s != this.goalTile) s.text_index = gs;

				s.parents.push(n);
				s.g = gs;

				//Later list used for visualization only
				this.laterList.push(s);
				//Remove from now list
				var index = this.nowList.indexOf(s);
				if (index != -1) {
					this.nowList.splice(index, 1);
				}
				//Add into next iteration
				this.nowList.splice(i + 1, 0, s);
				addToCache(s, gs);
				
				//Limit f value to found child to avoid critical f value increase in certain cases
				if (gs< this.fMin) 
				{
					this.fLimit = Math.min(gs, this.fMin);
				}
			}
			this.nowList.splice(i, 1);
			--i;
			if (this.doYield) yield;
		}
		this.laterList.length = 0;
		if (!found) {
			if (f_min_changed) {
				this.fLimit =  this.fMin;
			}
			else if (noTilesLeftToCheck){
				break;
			}

			if (this.doYield) yield;
		}
	}

	if (found) {
		//Create path
		var tile = this.goalTile;
		while (tile != null && tile != this.startTile) {
			this.fullPath.push(tile);

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

	this.currentN = null;
	this.pathfinderOn = false;
	yield false;
}

CanvasState.prototype.GetTile = function (x, y, dx, dy) {
	if (x + dx < 0 || x + dx >= this.gridWidth || y + dy < 0 || y + dy >= this.gridHeight)
		return null;

	var min_x = y * this.gridWidth;

	if (dy == 0) {
		var xx = min_x + x + dx;
		return this.shapes[xx];
	} else {
		if (dy > 0) {
			var yy = min_x + x + this.gridWidth;
			return this.shapes[yy];
		} else {
			var yy = min_x + x - this.gridWidth;
			return this.shapes[yy];
		}
	}
}

CanvasState.prototype.SetStartTile = function (tile){
	if (tile != null) {
		if (this.startTile != null) {
			this.startTile.text = "";
		}
		this.startTile = tile;
		this.startTile.text = "S";
	}
}

CanvasState.prototype.SetGoalTile = function (tile){
	if (tile != null) {
		if (this.goalTile != null) {
			this.goalTile.text = "";
		}
		this.goalTile = tile;
		this.goalTile.text = "G";
	}
}

// While Draw is called as often as the INTERVAL variable demands,
// It only ever does something if the canvas gets invalidated by our code
CanvasState.prototype.Draw = function () {
	// If our state is invalid, redraw and validate!
	if (this.valid)
		return;

	var ctx = this.ctx;
	ctx.clearRect(0, 0, this.width, this.height);
	
	var shapes = this.shapes;
	
	// Now list
	var l = this.nowList.length;
	for (var i = 0; i < l; i++) {
		var shape = this.nowList[i];

		ctx.fillStyle = "green";
		ctx.fillRect(shape.x, shape.y, shape.w, shape.h);
	}

	// Later list
	var l = this.laterList.length;
	for (var i = 0; i < l; i++) {
		var shape = this.laterList[i];

		ctx.fillStyle = "orange";
		ctx.fillRect(shape.x, shape.y, shape.w, shape.h);
	}

	// Path
	var l = this.fullPath.length;
	for (var i = 0; i < l; i++) {
		var shape = this.fullPath[i];

		ctx.fillStyle = "red";
		ctx.fillRect(shape.x, shape.y, shape.w, shape.h);
	}

	// All tiles
	var l = shapes.length;
	for (var i = 0; i < l; i++) {
		var shape = shapes[i];
		shapes[i].Draw(ctx);
	}

	// Draw selectedTile
	if (this.selectedTile != null) {
		ctx.strokeStyle = this.selectionColor;
		ctx.lineWidth = this.selectionWidth;
		ctx.strokeRect(this.selectedTile.x, this.selectedTile.y, this.selectedTile.w, this.selectedTile.h);
	}

	// Draw current tile
	if (this.currentN != null) {
		ctx.strokeStyle = "magenta";
		ctx.strokeRect(this.currentN.x, this.currentN.y, this.currentN.w, this.currentN.h);
	}

	var cx = this.gridWidth * 32 + 32,
	cy = 32,
	dif = 24;

	//Draw help text
	if (this.helpOn) {
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
	if (!this.doYield) {
		ctx.fillText("Instant", cx, cy);
	} else if (this.autoSimulate) {
		ctx.fillText("Auto", cx, cy);
	}

	cx = 10;
	cy = this.gridHeight * 32 + 32;

	//Draw Stats
	if (this.tileCheckAmount > 0) {
		ctx.fillText("Stats:", cx, cy);
		cy += dif * 1.5;
		ctx.fillText("Tile checks: " + this.tileCheckAmount, cx, cy);
		cy += dif;
		ctx.fillText("Tile child checks: " + this.tileChildCheckAmount, cx, cy);
		cy += dif;
		ctx.fillText("F limit: " + this.fLimit, cx, cy);
	}

	this.valid = true;

	//Auto_update
	if (this.autoSimulate && this.pathfinderOn) {
		if (this.auto_index > 0) {
			--this.auto_index;
		} else {
			this.auto_index = this.auto_index_delay;
			this.pathfinder.next();
		}
		this.valid = false;
	}

	//Draw walls
	if (this.creatingWalls && this.selectedTile != this.startTile && this.selectedTile != this.goalTile) {
		this.selectedTile.blocked = this.paintOn;
	}
}

// Creates an object with x and y defined, set to the mouse position relative to the canvas
CanvasState.prototype.GetMouse = function (e) {
	var element = this.canvas,
	offsetX = 0,
	offsetY = 0;

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

	// We return a simple javascript object (a hash) with x and y defined
	return {x : e.pageX - offsetX, y : e.pageY - offsetY};
}

function CanvasState(canvas) {
	this.canvas = canvas;
	this.width = canvas.width;
	this.height = canvas.height;
	this.gridWidth = 0;
	this.gridHeight = 0;
	this.ctx = canvas.getContext('2d');
	
	// This complicates things a little but but fixes mouse co-ordinate problems
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

	//Directions
	this.directions = [
		{x : 1, y : 0}, 
		{x :-1, y : 0},
		{x : 0, y : 1},
		{x : 0, y :-1}
	]

	// State tracking
	this.dragging = false;

	this.valid = false; // When set to false, the canvas will redraw everything
	this.shapes = []; // The collection of things to be drawn

	this.paintOn = true;
	this.creatingWalls = false;
	this.selectedTile = null,
	startTile = null,
	goalTile = null;

	// Input events
	var myState = this;

	canvas.addEventListener('mousedown', function (e) {
		myState.dragging = true;

		var mouse = myState.GetMouse(e);
		var mx = mouse.x;
		var my = mouse.y;
		var shapes = myState.shapes;
		var l = shapes.length;
		// Select tile
		for (var i = l - 1; i >= 0; i--) {
			if (shapes[i].Contains(mx, my)) {
				var shape = shapes[i];

				if (myState.selectedTile != shape) {
					myState.paintOn = !shape.blocked;

					myState.selectedTile = shape;
					myState.valid = false;
				}
				return;
			}
		}
	}, true);

	canvas.addEventListener('mousemove', function (e) {
		if (!myState.dragging)
			return;
		var mouse = myState.GetMouse(e);
		var mx = mouse.x;
		var my = mouse.y;
		var shapes = myState.shapes;
		var l = shapes.length;
		// Select tile
		for (var i = l - 1; i >= 0; i--) {
			if (shapes[i].Contains(mx, my)) {
				var shape = shapes[i];

				if (!myState.creatingWalls) 
					myState.paintOn = !shape.blocked;

				myState.selectedTile = shape;
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

		if (!myState.pathfinderOn) {
			if (e.keyCode == 83) { //s
				if (myState.selectedTile.blocked || myState.selectedTile == myState.goalTile) return;

				myState.SetStartTile(myState.selectedTile);
			}
			if (e.keyCode == 71) { //g
				if (myState.selectedTile.blocked || myState.selectedTile == myState.startTile) return;

				myState.SetGoalTile(myState.selectedTile);
			}

			if (e.keyCode == 87) { //w
				myState.paintOn = !myState.paintOn;
				myState.creatingWalls = false;
			}
		}

		if (e.keyCode == 78) { //n
			// Start/continue pathfinder
			if (!myState.pathfinderOn) {
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
			// Debug test
			console.log("current:");
			console.log(myState.selectedTile);
			console.log("adjacent:");
			for (var i = 0; i < 4; ++i) {
				var d = myState.directions[i];
				console.log(myState.GetTile(myState.selectedTile.gridX, myState.selectedTile.gridY, d.x, d.y));
			}
		}

		if (e.keyCode == 65) { //a
			myState.autoSimulate = !myState.autoSimulate;
		}

		if (e.keyCode == 73) { //i
			myState.doYield = !myState.doYield;
		}

		if (e.keyCode == 72) { //h
			myState.helpOn = !myState.helpOn;
		}

		myState.valid = false;

	}, false);

	canvas.addEventListener('keydown', function (e) {
		e = e || window.event;

		if (!myState.pathfinderOn) {
			if (e.keyCode == 87) { //w
				myState.creatingWalls = true;
			}
		}
		myState.valid = false;
	}, false);

	// Options
	this.helpOn = true;
	this.selectionColor = '#CC0000';
	this.selectionWidth = 2;
	this.interval = 30;
	
	//Draw loop
	setInterval(function () {
		myState.Draw();
	}, myState.interval);

	// Pathfinder algorithm state
	this.pathfinder;
	this.pathfinderOn = false;
	this.nowList = [];
	this.laterList = [];
	this.gCache = {};
	this.fullPath = [];
	this.currentN;

	this.doYield = true;

	this.autoSimulate = true;
	this.auto_index = 0;
	this.auto_delay = 0;

	this.fLimit;
	this.fMin;

	// Path finder stats
	this.tileCheckAmount = 0;
	this.tileChildCheckAmount = 0;
}

CanvasState.prototype.createGrid = function (width, height) {
	this.gridWidth = width;
	this.gridHeight = height;
	var startX = 10,
	startY = 10,
	tileW = 32,
	tileH = 32;

	var id = 0;
	for (var h = 0; h < height; ++h) {
		for (var w = 0; w < width; ++w) {
			this.shapes.push(new Tile(id++, w, h, startX + w * tileW, startY + h * tileH, tileW, tileH));
		}
	}
	
	//Set default start and end positions
	var startTile = this.GetTile(width/4, height/4, 0, 0);
	this.SetStartTile(startTile);
	
	var goalTile = this.GetTile(width - width/4, height - height/4, 0, 0);
	this.SetGoalTile(goalTile);
	
	this.valid = false;
}

function init(canvasname) {
	var s = new CanvasState(document.getElementById(canvasname));
	s.createGrid(20, 20);
}

init("canvas");