// Constructor for Tile objects to hold data for all drawn objects.
// For now they will just be defined as rectangles.
function Tile(gx,gy,x,y,w,h) {
	this.gx=gx;
	this.gy=gy;
	this.x = x || 0;
	this.y = y || 0;
	this.w = w || 1;
	this.h = h || 1;
  
	this.text="";
	this.blocked=false;
	
	this.hash=gx+""+gy;
	
	this.parents=[];
	this.f=0;
}

Tile.prototype.toString=function(){
	return this.hash;
}

// Draws this shape to a given context
Tile.prototype.draw = function(ctx) {

ctx.beginPath();

if (this.blocked){
	ctx.fillStyle = 'gray';
	ctx.fillRect(this.x, this.y, this.w, this.h);
}
ctx.strokeStyle = 'black';
ctx.rect(this.x, this.y, this.w, this.h);

ctx.font="20px Arial";
ctx.strokeText(this.text,this.x+this.w/2,this.y+this.h/2);

ctx.stroke();
}

// Determine if a point is inside the shape's bounds
Tile.prototype.contains = function(mx, my) {
  // All we have to do is make sure the Mouse X,Y fall in the area between
  // the shape's X and (X + Height) and its Y and (Y + Height)
  return  (this.x <= mx) && (this.x + this.w >= mx) &&
          (this.y <= my) && (this.y + this.h >= my);
}

Tile.prototype.heuristicTo= function(other){
	var xd=this.gx-other.gx,yd=this.gy-other.gy;
	//return Math.abs(xd)+Math.abs(yd);
	
	return Math.sqrt(xd*xd+yd*yd);
}

function CanvasState(canvas) {
  // **** First some setup! ****
  
  this.canvas = canvas;
  this.width = canvas.width;
  this.height = canvas.height;
  this.gw=0;
  this.gh=0;
  this.ctx = canvas.getContext('2d');
  // This complicates things a little but but fixes mouse co-ordinate problems
  // when there's a border or padding. See getMouse for more detail
  var stylePaddingLeft, stylePaddingTop, styleBorderLeft, styleBorderTop;
  if (document.defaultView && document.defaultView.getComputedStyle) {
    this.stylePaddingLeft = parseInt(document.defaultView.getComputedStyle(canvas, null)['paddingLeft'], 10)      || 0;
    this.stylePaddingTop  = parseInt(document.defaultView.getComputedStyle(canvas, null)['paddingTop'], 10)       || 0;
    this.styleBorderLeft  = parseInt(document.defaultView.getComputedStyle(canvas, null)['borderLeftWidth'], 10)  || 0;
    this.styleBorderTop   = parseInt(document.defaultView.getComputedStyle(canvas, null)['borderTopWidth'], 10)   || 0;
  }
  // Some pages have fixed-position bars (like the stumbleupon bar) at the top or left of the page
  // They will mess up mouse coordinates and this fixes that
  var html = document.body.parentNode;
  this.htmlTop = html.offsetTop;
  this.htmlLeft = html.offsetLeft;

  //directions
  this.directions=[{x:1,y:0},{x:-1,y:0},{x:0,y:1},{x:0,y:-1}]
  
  // **** Keep track of state! ****
  
  this.valid = false; // when set to false, the canvas will redraw everything
  this.shapes = [];  // the collection of things to be drawn
  
  this.selected_tile = null, start_tile=null, goal_tile=null;
  
  // **** Input events! ****

  var myState = this;

  canvas.addEventListener('mousedown', function(e) {
    var mouse = myState.getMouse(e);
    var mx = mouse.x;
    var my = mouse.y;
    var shapes = myState.shapes;
    var l = shapes.length;
	//select
    for (var i = l-1; i >= 0; i--) {
      if (shapes[i].contains(mx, my)) {
        var mySel = shapes[i];
        myState.selected_tile = mySel;
        myState.valid = false;
        return;
      }
    }
	//deselect it
    if (myState.selected_tile) {
      myState.selected_tile = null;
      myState.valid = false; // Need to clear the old selected_tile border
    }
  }, true);
  
  canvas.addEventListener('keyup',function(e){
	e=e||window.event;
	
	if (!myState.pathfinder_on){
		if (e.keyCode==83){//s
			if (myState.selected_tile.blocked||myState.selected_tile==myState.goal_tile) return;
			
			if (myState.selected_tile!=null){
				if (myState.start_tile!=null){
					myState.start_tile.text="";
				}
				myState.start_tile=myState.selected_tile;
				myState.start_tile.text="S";
			}
		}
		if (e.keyCode==71){//g
			if (myState.selected_tile.blocked||myState.selected_tile==myState.start_tile) return;
		
			if (myState.selected_tile!=null){
				if (myState.goal_tile!=null){
					myState.goal_tile.text="";
				}
				myState.goal_tile=myState.selected_tile;
				myState.goal_tile.text="G";
			}
		}
		if (e.keyCode==87){//w
			if (myState.selected_tile==myState.start_tile||myState.selected_tile==myState.goal_tile) return;
			myState.selected_tile.blocked=!myState.selected_tile.blocked;
		}
	}
	
	if (e.keyCode==78){//n
		//start/continue pathfinder
		if (!myState.pathfinder_on){
			myState.pathfinder=myState.UpdatePathfinder();
		}
		myState.pathfinder.next();
	}
	
	if (e.keyCode==82){//r
		myState.ResetGrid();
	}
	
	if (e.keyCode==77){//m
		myState.ResetPathfinder();
	}
	
	if (e.keyCode==84){//t
		//test
		console.log("current:");
		console.log(myState.selected_tile);
		console.log("adjacent:");
		for (var i=0;i<4;++i){
			var d=myState.directions[i];
			console.log(
			myState.GetTile(
				myState.selected_tile.gx,myState.selected_tile.gy,
				d.x,d.y)
			);
		}
	}
	
	if (e.keyCode==72){//h
		myState.help_on=!myState.help_on;
	}
  
	myState.valid=false;
	
  },false);
  
  // **** Options! ****
  
  this.help_on=true;
  this.selectionColor = '#CC0000';
  this.selectionWidth = 2;  
  this.interval = 30;
  setInterval(function() { myState.draw(); }, myState.interval);
  
  //pathfinder algorithm state
  this.pathfinder;
  this.pathfinder_on=false;
  this.now_list = [];
  this.later_list = [];
  this.g_cache = {};
  this.full_path=[];
  this.current_n;
  
  this.f_limit;
  this.f_min;
}

CanvasState.prototype.ResetGrid=function(){
	for (var i=0;i<this.shapes.length;++i){
		this.shapes[i].blocked=false;
	}
}

CanvasState.prototype.ResetPathfinder=function(){
	this.g_cache = {};
	this.now_list.length=0;
	this.later_list.length=0;
	this.full_path.length=0;
	
	this.pathfinder_on=false;
}

CanvasState.prototype.UpdatePathfinder=function(){
	if (this.start_tile==null||this.goal_tile==null) yield false;
	console.log("pathfinder set up");
	this.ResetPathfinder();
	
	//set up values
	this.f_limit=this.start_tile.heuristicTo(this.goal_tile)+1;
	console.log("start limit: "+this.f_limit);
	this.found=false;
	
	//set up starting now list
	this.now_list.push(this.start_tile);
	
	var state=this;
	var addToCache=function(tile,value){
		state.g_cache[tile]={t:tile,v:value};
	}
	
	addToCache(this.start_tile,1);
	
	this.pathfinder_on=true;
	var found=false;
	
	while(!found){
		this.f_min=9999999999;
		var f_min_changed=false;
		console.log("pathfinder loop");
		//var l=this.now_list.length;
		
		var i=0;
		var l=this.now_list.length;
		for (;i<this.now_list.length;++i){
			console.log("next tile!");
			var n=this.now_list[i];
			this.current_n=n;
			
			if (n==null||n.blocked) continue;
			
			var g=this.g_cache[n].v;
			var f=g+n.heuristicTo(this.goal_tile);
			
			n.f=f;
			
			if (n==this.goal_tile){
				found=true;
				console.log("Found goal!");
				break;
			}
				
			if (f>this.f_limit){
				this.f_min=Math.min(f,this.f_min);
				f_min_changed=true;
				console.log("skipped tile, too far away!");
				continue;
			}

			yield undefined;
			console.log("iterating children!");
			//iterate children
			for (var j=0;j<4;++j){
				var d=this.directions[j];
				var s=this.GetTile(n.gx,n.gy,d.x,d.y);
				console.log("child "+j);
				
				if (s==null||n.blocked) continue;
				
				s.parents.push(n);
				
				var gs=g+1;//dev.temp cost 1
				var gt=this.g_cache[s];
				if (gt!=undefined){
					console.log(""+gt.v+ ", " +s.toString());
					if (gs>=gt.v){
						continue;//this child tested before with better results
					}
				}
				console.log("added to later list");
				this.later_list.push(s);
				//remove from now list
				var index=this.now_list.indexOf(s);
				if (index!=-1){
					this.now_list.splice(index,1);
				}
				
				//add into next iteration
				//this.now_list.splice(this.now_list.length,0,s);
				this.now_list.splice(i+1,0,s);
				addToCache(s,gs);
			}
			this.now_list.splice(i,1);
			--i;
			console.log("iterating children done! ");
			yield undefined;
			this.later_list.length=0;
		}
		
		if (!found){
			if (f_min_changed){
				this.f_limit=this.f_min;
			}
			console.log("f limit: "+this.f_limit);
			console.log("next iteration please! ");
			yield undefined;
		}
	}
	
	//create path
	var tile=this.goal_tile;

	while(tile!=this.start_tile){
		this.full_path.push(tile);
	
		var min=tile.f*2;
		var next=null;
		for (var i=0;i<tile.parents.length;++i){
			var parent=tile.parents[i];
			if (parent.f<min){
				next=parent;
				min=parent.f;
			}
		}
		console.log(""+tile.gx+" , "+tile.gy);
		tile=next;
	}
	
	console.log("path size: "+this.full_path.length);
	
	for (var i=0;i<this.full_path.length;++i){
		var t=this.full_path[i];
		console.log(t.hash);
	}
	
	
	//this.pathfinder_on=false;
	yield false;
}

CanvasState.prototype.GetTile=function(x,y,dx,dy){
	if (x+dx<0||x+dx>=this.gw||y+dy<0||y+dy>=this.gh) return null;
	
	var min_x=y*this.gw;
	
	if (dy==0){
		var xx=min_x+x+dx;
		return this.shapes[xx];
	}
	else{
		if (dy>0){
			var yy=min_x+x+this.gw;
			return this.shapes[yy];
		}
		else{
			var yy=min_x+x-this.gw;;
			return this.shapes[yy];
		}
	}
}

CanvasState.prototype.addShape = function(shape) {
  this.shapes.push(shape);
  this.valid = false;
}

CanvasState.prototype.createGrid = function(width,height) {
	this.gw=width;
	this.gh=height;
	var start_x=10,start_y=10,tile_w=32,tile_h=32;
	
	for (var h=0;h<height;++h){
		for (var w=0;w<width;++w){
			 this.shapes.push(new Tile(w,h,start_x+w*tile_w,start_y+h*tile_h,tile_w,tile_h));
		}
	}
 
	this.valid = false;
}

CanvasState.prototype.clear = function() {
  this.ctx.clearRect(0, 0, this.width, this.height);
}

// While draw is called as often as the INTERVAL variable demands,
// It only ever does something if the canvas gets invalidated by our code
CanvasState.prototype.draw = function() {
  // if our state is invalid, redraw and validate!
  if (this.valid) return;
  
    var ctx = this.ctx;
    var shapes = this.shapes;
    this.clear();

	// now list
    var l = this.now_list.length;
    for (var i = 0; i < l; i++) {
      var shape = this.now_list[i];
	  
      ctx.fillStyle = "green";
      ctx.fillRect(shape.x,shape.y,shape.w,shape.h);
    }
	
	//later list
	var l = this.later_list.length;
    for (var i = 0; i < l; i++) {
      var shape = this.later_list[i];
	  
      ctx.fillStyle = "orange";
      ctx.fillRect(shape.x,shape.y,shape.w,shape.h);
    }
    
	//path
	var l = this.full_path.length;
	for (var i = 0; i < l; i++) {
		var shape = this.full_path[i];
	  
		ctx.fillStyle = "red";
		ctx.fillRect(shape.x,shape.y,shape.w,shape.h);
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
      ctx.strokeRect(mySel.x,mySel.y,mySel.w,mySel.h);
    }
	
	// draw current tile
    if (this.current_n != null) {
      ctx.strokeStyle = "magenta";
      ctx.lineWidth = this.selectionWidth;
      var mySel = this.current_n;
      ctx.strokeRect(mySel.x,mySel.y,mySel.w,mySel.h);
    }
	
	if(this.help_on){
		//help
		var cx=this.gw*32+32, cy=32,dif=24;
		ctx.fillStyle="black";
		ctx.fillText("Help:",cx,cy);
		cy+=dif;
		ctx.fillText("LMB: select tile.",cx,cy);
		cy+=dif;
		ctx.fillText("S: set as start tile.\n",cx,cy);
		cy+=dif;
		ctx.fillText("G: set as goal tile.\n",cx,cy);
		cy+=dif;
		ctx.fillText("W: set as wall.\n",cx,cy);
		cy+=dif*2;
		ctx.fillText("N: start/continue pathfinder.\n",cx,cy);
		cy+=dif;
		ctx.fillText("M: stop pathfinder.\n",cx,cy);
		cy+=dif;
		ctx.fillText("R: stop pathfinder.\n",cx,cy);
		cy+=dif*2;
		ctx.fillText("H: open/close help.\n",cx,cy);
		cy+=dif;
	}
	
    this.valid = true;
}


// Creates an object with x and y defined, set to the mouse position relative to the state's canvas
// If you wanna be super-correct this can be tricky, we have to worry about padding and borders
CanvasState.prototype.getMouse = function(e) {
  var element = this.canvas, offsetX = 0, offsetY = 0, mx, my;
  
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
  return {x: mx, y: my};
}

function init(canvasname) {
  var s = new CanvasState(document.getElementById(canvasname));
  s.createGrid(25,25);
}