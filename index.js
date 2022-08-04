const express = require('express')
const bodyParser = require('body-parser')
const url = require('url');
const app = express()
const axios = require('axios')
const {
    Heap
} = require('heap-js');
const graph = require('./data/graph.json');
const {
    start
} = require('repl');
const cors  = require("cors");
var distance = require('euclidean-distance')
var population = require('./data/infected.json');

const port = 3000
app.listen(port);
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
    extended: false
}))
app.use(cors());
app.set('view engine', 'ejs');


app.get('/', (req, res) => {
    res.render('map');
})

app.post('/getpath', async (req, res) => {
    var start_la = req.body.start_la;
    var start_lo = req.body.start_lo;
    var end_la = req.body.end_la
    var end_lo = req.body.end_lo;
    // console.log(req.body);
    var inds = getNearestNode(start_la, start_lo);
    var inde = getNearestNode(end_la, end_lo);
    console.log(inds);
    console.log(inde);
    start_la = graph[inds].la;
    start_lo = graph[inds].lo;


    end_la = graph[inde].la;
    end_lo = graph[inde].lo;

    path = getSafestPath(inds, inde);
    // console.log(population);
    res.send(path);
})

app.get('/population',(req,res)=>{
 var pop = [];
 for(var i=0;i<population.length;i++)
 {
    pop.push([population[i].lo,population[i].la]);
 }
 res.send(pop);
})
function getSafestPath(inds, inde) {
    newgraph = generateWeight(graph);
    // console.log('here');
    const customPriorityComparator = (a, b) => a.dist - b.dist;
    var parent = new Array(6000).fill(-1);
    var dist = new Array(6000).fill(1000000000000);
    const pq = new Heap(customPriorityComparator);
    var start = inds;
    pq.push({
        'dist': 0,
        'i': start
    });
    dist[start] = 0;
    while (!pq.isEmpty()) {
        var top = pq.top()[0].i;
        pq.pop();
        // console.log(dist[top]);
        for (var i = 0; i < Object.keys(newgraph[top]).length; i++) {
            var child = newgraph[top][i].i;

            if (dist[child] > dist[top] + newgraph[top][i].w) {
                dist[child] = dist[top] + newgraph[top][i].w;
                pq.push({
                    'dist': dist[child],
                    'i': child
                })
                parent[child] = top;
            }
        }

    }

    // Generate Safest Path from parents array
    var finalpath = [];
    var curr = inde;
    finalpath.push([
        graph[curr].lo, graph[curr].la
    ]);
    while (parent[curr] != -1) {
        curr = parent[curr];
        finalpath.push([
            graph[curr].lo, graph[curr].la
        ]);
        // console.log(curr);
    }
    finalpath.reverse();
    // console.log(finalpath);
    return finalpath;
}

/**
 * function: returns net energy received by p1
 */
function find_angle(p1, p2, source) {
    a_sq = Math.pow((p1["la"] - p2["la"])*100000, 2) + Math.pow((p1["lo"] - p2["lo"])*100000, 2)
    b_sq = Math.pow((p1["la"] - source["la"])*100000, 2) + Math.pow((p1["lo"] - source["lo"])*100000, 2)
    c_sq = Math.pow((p2["la"] - source["la"])*100000, 2) + Math.pow((p2["lo"] - source["lo"])*100000, 2)
    angle = Math.acos((c_sq + b_sq - a_sq )/ (2 * Math.sqrt(c_sq) * Math.sqrt(b_sq)))
    net_angle = angle * b_sq / (b_sq + c_sq)
    // console.log(a_sq,b_sq,c_sq,angle);
    return net_angle;
}

function dist_contrib(p1, p2, source) {
    // 1m equivalent in terms of latitude
    var eps = 0
    var temp = 0.00001
    var dist = getDistanceFromLatLonInKm(temp, 0, 0, 0) * 1000
    eps = temp / dist
    var factor = 100000
    /*
     * y - y1 = y2 - y1 / x2 - x1 * ( x - x1 )
     * (y - y1) * (x2 - x1) = (y2 - y1) * (x - x1)
     * (x2-x1) * y - y1 * (x2-x1) = (y2-y1) * x - x1(y2-y1)
     * (y2-y1) * x + (x1 - x2) * y + y1 * (x2-x1) - x1 * (y2-y1) = 0
     * for variable x, y
    */
    // Need to scale
    y1 = p1["la"]
    y2 = p2["la"]
    x1 = p1["lo"]
    x2 = p1["lo"]
    y = source["la"]
    x = source["lo"]
    if (Math.abs(p1["la"] - p2["la"]) < eps)
        unnormalized_distance = Math.abs(p1["la"] - source["la"])
    else if (Math.abs(p1["lo"] - p2["lo"]) < eps)
        unnormalized_distance = Math.abs(p2["la"] - source["lo"])
    else
        unnormalized_distance = Math.abs((y2 - y1) * x + (x1 - x2) * y + y1 * (x2 - x1) - x1 * (y2 - y1)) / Math.sqrt(Math.pow(y2 - y1, 2) + Math.pow(x2 - x1, 2))
    normalized_distance = factor * unnormalized_distance;
    // How do we find the function? TODO
    return normalized_distance
}

function generateWeight(g) {
    var riskValue = [];
    // population = getRandomCrowd(28.6213, 28.6680, 77.1412, 77.2135, 1000);
    // Power simulation for our infected person
    var power = 100;
    var closeness = 1000
    for (var i = 0; i < graph.length; i++) {
        var g_ = graph[i];
        var curr_risk = 0;
        for (var j = 0; j < 1000; j++) {
            // curr_risk += getDistanceFromLatLonInKm(g_.la, g_.lo, population[j].la, population[j].lo);
            adj_list_node = g[i].e
            for (var k = 0; k < Object.keys(adj_list_node).length; k++) {
                // console.log(adj_list_node[k]);
                coordinates = {"la": graph[adj_list_node[k].i].la, "lo": graph[adj_list_node[k].i].lo}
                curr_risk += (find_angle({"la": graph[i].la, "lo": graph[i].lo}, coordinates, population[j]) * power*closeness/dist_contrib({"la": graph[i].la, "lo": graph[i].lo}, coordinates, population[j])  )/ (Math.PI * 2)
                // console.log(closeness/dist_contrib({"la": graph[i].la, "lo": graph[i].lo}, coordinates, population[j]));
           
            }
            
        }
        riskValue.push(curr_risk);
    }
    // console.log(riskValue);

    var newGraph = [];
    lambda = 0.1 // Change this accordingly
    for (var i = 0; i < Object.keys(g).length; i++) {
        var adjlist = [];
        var child = g[i].e;
        for (var j = 0; j < Object.keys(child).length; j++) {
            adjlist.push({
                'i': child[j].i,
                'w': lambda * child[j].w + riskValue[j] + riskValue[i] //Write the risk factor here 
            })
        }
        newGraph.push(adjlist);
    }

    return newGraph;
}


function getNearestNode(la, lo) {
    let mn_dist = 19007199254740991;
    let ind = 0;
    for (var i = 0; i < graph.length; i++) {
        var g = graph[i];
        var sum = getDistanceFromLatLonInKm(g.la, g.lo, la, lo);

        if (sum < mn_dist) {
            mn_dist = sum;
            ind = i;
        }
    }
    console.log(mn_dist);
    return ind;
}

function getDistanceFromLatLonInKm(lat1, lon1, lat2, lon2) {
    var R = 6371; // Radius of the earth in km
    var dLat = deg2rad(lat2 - lat1); // deg2rad below
    var dLon = deg2rad(lon2 - lon1);
    var a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    var d = R * c; // Distance in km
    return d;
}

function deg2rad(deg) {
    return deg * (Math.PI / 180)
}

/* not being used here */
function getRandomCrowd(la_min, la_max, lo_min, lo_max, population_size) {
    var population = [];
    for (var i = 0; i < population_size; i++) {
        population.push({
            'la': randLoc(la_min, la_max),
            'lo': randLoc(lo_min, lo_max)
        });
    }
    // console.log(population);
    return population;

}

function randLoc(min, max) {
    return Math.random() * (max - min) + min;
}
