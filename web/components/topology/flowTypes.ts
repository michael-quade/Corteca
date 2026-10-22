import type { EdgeTypes, NodeTypes } from "@xyflow/react";
import { ApNode } from "./ApNode";
import { ClientClusterNode } from "./ClientClusterNode";
import { SwitchNode } from "./SwitchNode";
import { WiredClientNode } from "./WiredClientNode";
import { BackhaulEdge } from "./BackhaulEdge";
import { RouteEdge } from "./RouteEdge";
import { SwitchUplinkEdge } from "./SwitchUplinkEdge";
import { WiredLinkEdge } from "./WiredLinkEdge";
import { InternetNode } from "./InternetNode";
import { WanEdge } from "./WanEdge";

// React Flow node / edge components for the topology canvas.
export const nodeTypes: NodeTypes = { ap: ApNode, cluster: ClientClusterNode, switch: SwitchNode, wired: WiredClientNode, internet: InternetNode };
export const edgeTypes: EdgeTypes = { backhaul: BackhaulEdge, route: RouteEdge, switchUplink: SwitchUplinkEdge, wiredLink: WiredLinkEdge, wan: WanEdge };
