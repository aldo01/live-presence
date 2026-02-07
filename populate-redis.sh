#!/bin/bash

# Populate Redis with live users near India location
docker exec -i live-presence-redis redis-cli <<EOF
# Charlie Davis
GEOADD presence:geo 77.46877281957158 28.648378064638308 e82a6410-066f-42b7-bde1-e7f9262e00f9
HSET presence:meta:e82a6410-066f-42b7-bde1-e7f9262e00f9 displayName "Charlie Davis" interest "Food" lat "28.648378064638308" lon "77.46877281957158" lastSeen "2025-12-23T12:40:00Z"
EXPIRE presence:meta:e82a6410-066f-42b7-bde1-e7f9262e00f9 300

# Frank Taylor
GEOADD presence:geo 77.48044503174289 28.667030120013074 d3073d53-3cdd-4d9e-b094-d299eee08fbd
HSET presence:meta:d3073d53-3cdd-4d9e-b094-d299eee08fbd displayName "Frank Taylor" interest "Gaming" lat "28.667030120013074" lon "77.48044503174289" lastSeen "2025-12-23T12:40:00Z"
EXPIRE presence:meta:d3073d53-3cdd-4d9e-b094-d299eee08fbd 300

# Liam White
GEOADD presence:geo 77.47762293348595 28.639855474852173 07c6565e-f2bd-48eb-9414-669743aad8ff
HSET presence:meta:07c6565e-f2bd-48eb-9414-669743aad8ff displayName "Liam White" interest "Art" lat "28.639855474852173" lon "77.47762293348595" lastSeen "2025-12-23T12:40:00Z"
EXPIRE presence:meta:07c6565e-f2bd-48eb-9414-669743aad8ff 300

# Peter Walker
GEOADD presence:geo 77.4867091788259 28.65402365665214 7d8e3618-a5be-47b2-8cb6-36291e907661
HSET presence:meta:7d8e3618-a5be-47b2-8cb6-36291e907661 displayName "Peter Walker" interest "Sports" lat "28.65402365665214" lon "77.4867091788259" lastSeen "2025-12-23T12:40:00Z"
EXPIRE presence:meta:7d8e3618-a5be-47b2-8cb6-36291e907661 300

# Quinn Hall
GEOADD presence:geo 77.50054405395514 28.670671271519694 11cd78a5-b45a-4b5e-a757-9d895a2a5032
HSET presence:meta:11cd78a5-b45a-4b5e-a757-9d895a2a5032 displayName "Quinn Hall" interest "Music" lat "28.670671271519694" lon "77.50054405395514" lastSeen "2025-12-23T12:40:00Z"
EXPIRE presence:meta:11cd78a5-b45a-4b5e-a757-9d895a2a5032 300

# Rachel Allen
GEOADD presence:geo 77.47136503469673 28.65425401504219 d6465995-cdf4-43a3-9597-5c9e60feb35b
HSET presence:meta:d6465995-cdf4-43a3-9597-5c9e60feb35b displayName "Rachel Allen" interest "Tech" lat "28.65425401504219" lon "77.47136503469673" lastSeen "2025-12-23T12:40:00Z"
EXPIRE presence:meta:d6465995-cdf4-43a3-9597-5c9e60feb35b 300

# Sam Young
GEOADD presence:geo 77.49606330335804 28.649936374944634 28a878e9-1f4e-45e5-9986-625a7f68007b
HSET presence:meta:28a878e9-1f4e-45e5-9986-625a7f68007b displayName "Sam Young" interest "Food" lat "28.649936374944634" lon "77.49606330335804" lastSeen "2025-12-23T12:40:00Z"
EXPIRE presence:meta:28a878e9-1f4e-45e5-9986-625a7f68007b 300

# Tara King
GEOADD presence:geo 77.48649731294148 28.63462407493666 d58f2960-f757-4067-869e-f60834174db4
HSET presence:meta:d58f2960-f757-4067-869e-f60834174db4 displayName "Tara King" interest "Art" lat "28.63462407493666" lon "77.48649731294148" lastSeen "2025-12-23T12:40:00Z"
EXPIRE presence:meta:d58f2960-f757-4067-869e-f60834174db4 300

# Uma Wright
GEOADD presence:geo 77.50130234145546 28.6439901519887 f8a00be1-2538-44f2-ada3-025937d7f312
HSET presence:meta:f8a00be1-2538-44f2-ada3-025937d7f312 displayName "Uma Wright" interest "Travel" lat "28.6439901519887" lon "77.50130234145546" lastSeen "2025-12-23T12:40:00Z"
EXPIRE presence:meta:f8a00be1-2538-44f2-ada3-025937d7f312 300
EOF

echo "Redis populated with 9 live users near India location!"
