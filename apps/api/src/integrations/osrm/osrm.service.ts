import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';

@Injectable()
export class OsrmService {
  private readonly logger = new Logger(OsrmService.name);
  private readonly OSRM_BASE_URL = 'http://router.project-osrm.org/route/v1/driving';

  /**
   * Retrieves driving route distance and duration 
   * @param originLon Longitude of origin
   * @param originLat Latitude of origin
   * @param destLon Longitude of destination
   * @param destLat Latitude of destination
   * @returns object with distance (meters) and duration (seconds) or null on failure
   */
  async getRouteInfo(originLon: number, originLat: number, destLon: number, destLat: number): Promise<{ distanceMeters: number, durationSeconds: number } | null> {
    try {
      const url = `${this.OSRM_BASE_URL}/${originLon},${originLat};${destLon},${destLat}?overview=false`;
      const response = await axios.get(url);
      
      if (response.data && response.data.routes && response.data.routes.length > 0) {
        const route = response.data.routes[0];
        return {
          distanceMeters: route.distance,
          durationSeconds: route.duration
        };
      }
      return null;
    } catch (error: any) {
      this.logger.error(`Failed to fetch OSRM route: ${error.message}`);
      return null;
    }
  }

  metersToMiles(meters: number): number {
    return meters * 0.000621371;
  }
}
