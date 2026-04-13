import { v4 as uuidv4 } from 'uuid';

export default function setupRoutes(app) {
  app.get('/', (_, res) => {
    res.redirect(`/${uuidv4()}`);
  });

  app.get('/:room', (req, res) => {
    res.render('room', { roomId: req.params.room });
  });
}
