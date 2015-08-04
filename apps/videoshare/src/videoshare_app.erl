-module(videoshare_app).
-behaviour(application).
-export([start/0, start/2, stop/1]).

start() ->
  % Start the needed applications.
    ok = application:start(compiler),
    ok = application:start(ranch),
    ok = application:start(crypto),
    ok = application:start(cowlib),
    ok = application:start(cowboy),
    ok = application:start(gproc),
    ok = application:start(videoshare).

start(_StartType, _StartArgs) ->
  Dispatch = cowboy_router:compile(
    [
      {'_', [{"/", handler_websocket, []} ]}
    ]),
  {ok, _} = cowboy:start_http(websocket, 100, 
    [{port, 30000}], 
      [{env, [{dispatch, Dispatch}]}, 
        {max_keepalive, 50}, {timeout, 500} 
      ]),
  videoshare_sup:start_link().

stop(_State) ->
  ok.