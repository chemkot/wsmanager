package main

import (
	"flag"
	"fmt"
	"log"
	"net/http"
	"strconv"
	"strings"
	"time"

	"golang.org/x/net/websocket"
)

type Message struct {
	Text string `json:"text"`
}

type hub struct {
	clients          map[string]*websocket.Conn
	addClientChan    chan *websocket.Conn
	removeClientChan chan *websocket.Conn
	broadcastChan    chan Message
}

var (
	port = flag.String("port", "1234", "port used for ws connection")
)

func main() {
	flag.Parse()
	log.Fatal(server(*port))
}

// server creates a websocket server at port <port> and registers the sole handler
func server(port string) error {
	h := newHub()
	mux := http.NewServeMux()
	mux.Handle("/ws", websocket.Handler(func(ws *websocket.Conn) {
		handler(ws, h)
	}))
	mux.Handle("/", http.StripPrefix("/", noDirListing(http.FileServer(http.Dir("./static")))))

	s := http.Server{Addr: ":" + port, Handler: mux}
	return s.ListenAndServe()
}

// handler registers a new chat client conn;
// It runs the hub, adds the client to the connection pool
// and broadcasts received message
func handler(ws *websocket.Conn, h *hub) {
	go h.run()

	h.addClientChan <- ws

	for {
		var m Message
		// /var s string
		//err := websocket.Message.Receive(ws, &s)
		err := websocket.JSON.Receive(ws, &m)
		if err != nil {

			h.broadcastChan <- Message{err.Error()}
			h.removeClient(ws)
			return
		}
		fmt.Println("received: " + m.Text)

		h.broadcastChan <- m
	}
}

// newHub returns a new hub object
func newHub() *hub {
	return &hub{
		clients:          make(map[string]*websocket.Conn),
		addClientChan:    make(chan *websocket.Conn),
		removeClientChan: make(chan *websocket.Conn),
		broadcastChan:    make(chan Message),
	}
}

// run receives from the hub channels and calls the appropriate hub method
func (h *hub) run() {
	for {
		select {
		case conn := <-h.addClientChan:
			h.addClient(conn)
		case conn := <-h.removeClientChan:
			h.removeClient(conn)
		case m := <-h.broadcastChan:
			h.broadcastMessage(m)
		}
	}
}

// removeClient removes a conn from the pool
func (h *hub) removeClient(conn *websocket.Conn) {
	delete(h.clients, conn.LocalAddr().String())
	fmt.Println("remove client")
}

// addClient adds a conn to the pool
func (h *hub) addClient(conn *websocket.Conn) {
	var s = conn.RemoteAddr().String() + strconv.FormatInt(time.Now().UnixNano(), 10)
	h.clients[s] = conn
	fmt.Println("add client " + s)
}

// broadcastMessage sends a message to all client conns in the pool
func (h *hub) broadcastMessage(m Message) {
	for _, conn := range h.clients {
		err := websocket.JSON.Send(conn, m)

		if err != nil {
			fmt.Println("Error broadcasting message: ", err) // при некоторых типах ошибок удаляем клиента
		} else {
			fmt.Println("send to client")
		}
	}
}

func noDirListing(h http.Handler) http.HandlerFunc {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if strings.HasSuffix(r.URL.Path, "/") || r.URL.Path == "" {
			http.NotFound(w, r)
			return
		}
		h.ServeHTTP(w, r)
	})

}

/*
func main() {
	http.Handle("/ws", websocket.Handler(Echo))
	http.Handle("/", http.StripPrefix("/", http.FileServer(http.Dir("./static"))))

	if err := http.ListenAndServe(":1234", nil); err != nil {
		log.Fatal("ListenAndServe:", err)
	}
}


func main() {
	//database.InitDB()
	//defer database.MainDB.Close()

	http.Handle("/", http.StripPrefix("/", http.FileServer(http.Dir("./static"))))
	http.HandleFunc("/login", loginHandler)

	router := mux.NewRouter()

	router.HandleFunc("/device", controllers.Device).Methods("POST")
	router.HandleFunc("/ui", controllers.UI).Methods("POST")

	router.PathPrefix("/").Handler(http.FileServer(http.Dir("./HTML/")))

	router.Use(app.AuthenticationMidlleware) //attach auth middleware

	port := "80" //localhost 8000

	fmt.Println(port)

	go app.CheckAlarmsRoutine()

	err := http.ListenAndServe(":"+port, router) //Launch the app, visit localhost:8000/api
	if err != nil {
		fmt.Print(err)
	}
}

func noDirListing(h http.Handler) http.HandlerFunc {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if strings.HasSuffix(r.URL.Path, "/") || r.URL.Path == "" {
			http.NotFound(w, r)
			return
		}
		h.ServeHTTP(w, r)
	})
}*/

