import { test, expect } from '@playwright/test';

const API = 'http://localhost:8000';

test.describe('API Health & Mock Endpoints', () => {
  test('GET /health returns ok', async ({ request }) => {
    const res = await request.get(`${API}/health`);
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.status).toBe('ok');
  });

  test('POST /api/floorplan/mock returns valid FloorPlanResult', async ({ request }) => {
    const res = await request.post(`${API}/api/floorplan/mock`);
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.floorplan_image).toBeTruthy();
    expect(body.walls).toBeInstanceOf(Array);
    expect(body.walls.length).toBeGreaterThan(0);
    expect(body.metadata.pixels_per_meter).toBe(50);
    expect(body.rooms).toBeInstanceOf(Array);
    expect(body.rooms.length).toBeGreaterThan(0);

    // Verify wall structure
    const wall = body.walls[0];
    expect(wall).toHaveProperty('x1');
    expect(wall).toHaveProperty('y1');
    expect(wall).toHaveProperty('x2');
    expect(wall).toHaveProperty('y2');
  });

  test('POST /api/furniture/mock returns furniture array', async ({ request }) => {
    const res = await request.post(`${API}/api/furniture/mock`);
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.furniture).toBeInstanceOf(Array);
    expect(body.furniture.length).toBeGreaterThan(0);

    // Verify furniture item structure
    const item = body.furniture[0];
    expect(item).toHaveProperty('id');
    expect(item).toHaveProperty('name');
    expect(item).toHaveProperty('dimensions');
    expect(item.dimensions).toHaveProperty('w');
    expect(item.dimensions).toHaveProperty('h');
    expect(item.dimensions).toHaveProperty('d');
  });

  test('POST /api/placement/mock returns placements', async ({ request }) => {
    const res = await request.post(`${API}/api/placement/mock`);
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.placements).toBeInstanceOf(Array);
    expect(body.placements.length).toBeGreaterThan(0);

    const p = body.placements[0];
    expect(p).toHaveProperty('furniture_id');
    expect(p.position).toHaveProperty('x');
    expect(p.position).toHaveProperty('y');
    expect(p.position).toHaveProperty('z');
    expect(p.position.y).toBeGreaterThan(0); // sitting on floor
    expect(p.rotation).toHaveProperty('y');
  });

  test('POST /api/cost/estimate/mock returns total > 0', async ({ request }) => {
    const res = await request.post(`${API}/api/cost/estimate/mock`);
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.total).toBeGreaterThan(0);
    expect(body.breakdown).toBeInstanceOf(Array);
    expect(body.breakdown.length).toBeGreaterThan(0);

    // Verify breakdown structure
    const b = body.breakdown[0];
    expect(b).toHaveProperty('item');
    expect(b).toHaveProperty('amount');
    expect(b).toHaveProperty('description');
  });

  test('POST /api/placement/compute with furniture returns valid placements', async ({ request }) => {
    // Get mock furniture first
    const furRes = await request.post(`${API}/api/furniture/mock`);
    const furBody = await furRes.json();

    const computeRes = await request.post(`${API}/api/placement/compute`, {
      data: {
        floorplan_id: 'mock',
        furniture_items: furBody.furniture.slice(0, 3).map((f: any) => ({
          furniture_id: f.id,
          dimensions: f.dimensions,
          type: f.name,
        })),
      },
    });
    expect(computeRes.ok()).toBeTruthy();
    const body = await computeRes.json();
    expect(body.placements).toBeInstanceOf(Array);
    expect(body.placements.length).toBeGreaterThan(0);
  });
});
