package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"

	"github.com/gobwas/ws"
	"github.com/gobwas/ws/wsutil"
)

type Message struct {
	Version string          `json:"jsonrpc"`
	Method  string          `json:"method,omitempty"`
	Params  json.RawMessage `json:"params,omitempty"`
	Error   json.RawMessage `json:"error,omitempty"`
	Result  json.RawMessage `json:"result,omitempty"`
	ID      int64           `json:"id,omitempty"`
}

func wsHandler(w http.ResponseWriter, r *http.Request) {
	conn, _, _, err := ws.UpgradeHTTP(r, w)
	if err != nil {
		// handle error
	}
	go func() {
		defer conn.Close()

		for {
			msg, op, err := wsutil.ReadClientData(conn)
			fmt.Println("Rx <-", string(msg))
			if err != nil {
				fmt.Println("Read error")
				return
			}
			var m Message
			err = json.Unmarshal(msg, &m)
			if err != nil {
				fmt.Println("Parse error")
				continue
			}
			s := msg
			if m.Method == "testmethod" {
				m.Method = ""
				m.Result = []byte(`{"code": 1}`)
				m.Params = []byte("{}")
				s, err = json.Marshal(m)
				if err != nil {
					fmt.Println(err)
				}
			}

			if m.Method == "ping" {
				m.Method = "pong"
				m.Params = nil
				m.Result = nil
				s, err = json.Marshal(m)
				if err != nil {
					fmt.Println(err)
				}
			}
			fmt.Println("Tx ->", string(s))

			err = wsutil.WriteServerMessage(conn, op, s)
			if err != nil {
				// handle error
			}
		}
	}()
}

func main() {
	http.Handle("/", noDirListing(http.StripPrefix("/", http.FileServer(http.Dir("")))))
	http.HandleFunc("/ws", wsHandler)

	http.ListenAndServe(":1234", nil)
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
