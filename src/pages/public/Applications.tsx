import React from "react";
import { Navigate } from "react-router-dom";

/**
 * Legacy public applications pillar.
 * The production Applications experience now lives in the Pretoria-first
 * Course Match hub at /apply. Keep this route as a redirect so old links,
 * bookmarks and search results land on the current experience.
 */
export const Applications: React.FC = () => <Navigate to="/apply" replace />;

export default Applications;
